import 'server-only';

import { describe } from '../../../shared/validation';
import type { FieldError } from '../../../shared/errors';
import type { Locale } from '../../../i18n';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { validationFailed } from '../../lib/errors';
import { DEFAULT_SETTINGS } from '../../db/seed/settings';
import { setForceMockAi } from '../../adapters/ai';

/**
 * Administrator settings (AGENTS.md §7, §15).
 *
 * Only keys the product actually reads are editable: the three job intervals,
 * the OTP expiry/attempts/resend window, and the AI switch (`auto` uses Gemini
 * when a key exists, `off` forces the deterministic Mock AI provider). Every
 * write updates `System_Setting`, applies the change where it matters and
 * writes one audit row listing only the keys that actually changed.
 */

export const AI_MODE_SETTING_KEY = 'demo_ai_mode';

type SettingKind = 'int' | 'enum';

interface SettingDefinition {
  key: string;
  kind: SettingKind;
  min?: number;
  max?: number;
  options?: readonly string[];
}

const DEFINITIONS: SettingDefinition[] = [
  { key: 'case_sync_interval_minutes', kind: 'int', min: 1, max: 1440 },
  { key: 'hearing_reminder_interval_minutes', kind: 'int', min: 1, max: 1440 },
  { key: 'integration_health_interval_minutes', kind: 'int', min: 1, max: 1440 },
  { key: 'otp_expiry_minutes', kind: 'int', min: 1, max: 60 },
  { key: 'otp_max_attempts', kind: 'int', min: 1, max: 10 },
  { key: 'otp_resend_seconds', kind: 'int', min: 10, max: 600 },
  { key: AI_MODE_SETTING_KEY, kind: 'enum', options: ['auto', 'off'] },
];

const BY_KEY = new Map(DEFINITIONS.map((definition) => [definition.key, definition]));

export interface SettingDto {
  key: string;
  kind: SettingKind;
  value: string;
  min: number | null;
  max: number | null;
  options: string[] | null;
}

export interface SettingsService {
  list(): Promise<SettingDto[]>;
  update(actorId: number, input: unknown, locale: Locale): Promise<SettingDto[]>;
}

function toDto(definition: SettingDefinition, value: string): SettingDto {
  return {
    key: definition.key,
    kind: definition.kind,
    value,
    min: definition.min ?? null,
    max: definition.max ?? null,
    options: definition.options ? [...definition.options] : null,
  };
}

export function createSettingsService(options: {
  repos: Repositories;
  clock: Clock;
}): SettingsService {
  const { repos, clock } = options;

  async function current(definition: SettingDefinition): Promise<string> {
    const stored = await repos.settings.get(definition.key);
    return stored ?? DEFAULT_SETTINGS[definition.key] ?? '';
  }

  return {
    async list() {
      const rows: SettingDto[] = [];
      for (const definition of DEFINITIONS) {
        rows.push(toDto(definition, await current(definition)));
      }
      return rows;
    },

    async update(actorId, input, locale) {
      const record =
        typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
      const raw = record.settings;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw validationFailed([
          { field: 'settings', code: 'REQUIRED', message: describe(locale, 'required', { field: 'settings' }) },
        ]);
      }

      const errors: FieldError[] = [];
      const accepted: { key: string; value: string }[] = [];

      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const definition = BY_KEY.get(key);
        if (!definition) {
          errors.push({
            field: key,
            code: 'ENUM',
            message: describe(locale, 'invalidEnum', { field: key, allowed: [...BY_KEY.keys()].join(', ') }),
          });
          continue;
        }

        const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        if (definition.kind === 'enum') {
          const allowed = definition.options ?? [];
          if (!allowed.includes(text)) {
            errors.push({
              field: key,
              code: 'ENUM',
              message: describe(locale, 'invalidEnum', { field: key, allowed: allowed.join(', ') }),
            });
          } else {
            accepted.push({ key, value: text });
          }
          continue;
        }

        const parsed = Number(text);
        const min = definition.min ?? 0;
        const max = definition.max ?? Number.MAX_SAFE_INTEGER;
        if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
          errors.push({
            field: key,
            code: 'FORMAT',
            message: describe(locale, 'integerRange', { field: key, min, max }),
          });
        } else {
          accepted.push({ key, value: String(parsed) });
        }
      }

      if (errors.length > 0) throw validationFailed(errors);

      const changed: { key: string; from: string; to: string }[] = [];
      for (const entry of accepted) {
        const before = await current(BY_KEY.get(entry.key)!);
        if (before === entry.value) continue;
        await repos.settings.set(entry.key, entry.value);
        changed.push({ key: entry.key, from: before, to: entry.value });
      }

      if (changed.some((entry) => entry.key === AI_MODE_SETTING_KEY)) {
        const mode = changed.find((entry) => entry.key === AI_MODE_SETTING_KEY)?.to ?? 'auto';
        setForceMockAi(mode === 'off');
      }

      if (changed.length > 0) {
        await repos.audit.record({
          performedBy: actorId,
          action: 'SETTINGS_UPDATED',
          details: { changed },
          timestamp: clock.nowIso(),
        });
      }

      const rows: SettingDto[] = [];
      for (const definition of DEFINITIONS) {
        rows.push(toDto(definition, await current(definition)));
      }
      return rows;
    },
  };
}
