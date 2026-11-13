import 'server-only';

import { CATEGORY_NAMES } from '../../../shared/enums';
import type { Locale } from '../../../i18n';
import { validateCategoryListInput } from '../../../shared/validation';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { createValidationContext } from '../../http/validationContext';
import { validationFailed } from '../../lib/errors';

/**
 * Admin-managed guide categories (AGENTS.md §7).
 *
 * Categories are the stable text used in `Legal_Guide.category`; the editable
 * order lives in `System_Setting.guide_categories`. Seeded names remain the
 * fallback, and any category currently used by a guide is always listed so an
 * administrator can never hide live content by mistake.
 */

export const CATEGORY_SETTING_KEY = 'guide_categories';

export interface CategoryDto {
  name: string;
  guideCount: number;
}

export interface AdminCategoriesService {
  list(): Promise<CategoryDto[]>;
  replace(actorId: number, input: unknown, locale: Locale): Promise<CategoryDto[]>;
}

export function createAdminCategoriesService(options: {
  repos: Repositories;
  clock: Clock;
}): AdminCategoriesService {
  const { repos, clock } = options;

  async function withCounts(names: string[]): Promise<CategoryDto[]> {
    const counts = await repos.guides.categoryCounts();
    const countByName = new Map(counts.map((row) => [row.category, row.count]));

    const merged = [...names];
    for (const row of counts) {
      if (!merged.some((name) => name.toLowerCase() === row.category.toLowerCase())) {
        merged.push(row.category);
      }
    }

    return merged.map((name) => ({ name, guideCount: countByName.get(name) ?? 0 }));
  }

  return {
    async list() {
      const stored = await repos.settings.getJson<string[]>(CATEGORY_SETTING_KEY, [
        ...CATEGORY_NAMES,
      ]);
      return withCounts(stored.length > 0 ? stored : [...CATEGORY_NAMES]);
    },

    async replace(actorId, input, locale) {
      const validation = validateCategoryListInput(
        input,
        createValidationContext(repos, clock, locale),
      );
      if (!validation.ok) throw validationFailed(validation.errors);

      await repos.settings.setJson(CATEGORY_SETTING_KEY, validation.value.categories);
      await repos.audit.record({
        performedBy: actorId,
        action: 'CATEGORIES_UPDATED',
        details: { categories: validation.value.categories },
        timestamp: clock.nowIso(),
      });

      return withCounts(validation.value.categories);
    },
  };
}
