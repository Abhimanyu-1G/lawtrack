import 'server-only';

import type { AdminLevel, Language, UserRole } from '../../../shared/enums';
import type { Locale } from '../../../i18n';
import {
  describe,
  invalid,
  validateAdminUserInput,
  validateAdminUserUpdate,
  type AdminUserInput,
} from '../../../shared/validation';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { AppError, notFound, validationFailed } from '../../lib/errors';
import { hashPassword } from '../../lib/password';
import { createValidationContext } from '../../http/validationContext';
import type { UserRow } from '../users/repo';

/**
 * Administrator user management (AGENTS.md §3, §7).
 *
 * Public sign-up still creates Citizens only; this service is the privileged
 * path that creates the other four roles and can change an existing role. It
 * keeps the ER profile rows in step with `User.role`, writes one audit row per
 * change and never accepts a client-supplied password hash or primary key.
 */

export interface AdminUserDto {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: UserRole;
  language: Language;
  isVerified: boolean;
}

export interface AdminUserListDto {
  users: AdminUserDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUserFilter {
  role?: UserRole;
  query?: string;
  page?: string | number | null;
  pageSize?: string | number | null;
}

export interface AdminUserService {
  list(filter: AdminUserFilter): Promise<AdminUserListDto>;
  create(actorId: number, input: unknown, locale: Locale): Promise<AdminUserDto>;
  update(actorId: number, userId: number, input: unknown, locale: Locale): Promise<AdminUserDto>;
}

function toDto(row: UserRow): AdminUserDto {
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone_number,
    role: row.role,
    language: row.language,
    isVerified: row.is_verified === 1,
  };
}

export function createAdminUserService(options: {
  repos: Repositories;
  clock: Clock;
}): AdminUserService {
  const { repos, clock } = options;

  async function audit(actorId: number, action: string, details: unknown): Promise<void> {
    await repos.audit.record({
      performedBy: actorId,
      action,
      details,
      timestamp: clock.nowIso(),
    });
  }

  async function insertProfile(userId: number, input: AdminUserInput): Promise<void> {
    if (input.role === 'Citizen') {
      await repos.users.insertCitizen(userId, {
        address: input.address ?? null,
        state: input.state ?? null,
      });
      return;
    }
    if (input.role === 'Lawyer') {
      await repos.users.insertLawyer(userId, {
        barCouncilId: input.bar_council_id ?? '',
        specialization: input.specialization ?? null,
        experienceYears: input.experience_years ?? null,
      });
      return;
    }
    if (input.role === 'Curator') {
      await repos.users.insertCurator(userId, { expertise: input.specialization ?? null });
      return;
    }
    if (input.role === 'Administrator') {
      await repos.users.insertAdministrator(userId, {
        adminLevel: (input.admin_level ?? 'Standard') as AdminLevel,
      });
      return;
    }
    await repos.users.insertApiManager(userId, {
      managedServices: input.managed_services ?? null,
    });
  }

  return {
    async list(filter) {
      const result = await repos.users.list({
        role: filter.role,
        query: filter.query,
        page: filter.page,
        pageSize: filter.pageSize,
      });

      return {
        users: result.items.map(toDto),
        total: result.total,
        page: result.page.page,
        pageSize: result.page.pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / result.page.pageSize)),
      };
    },

    async create(actorId, input, locale) {
      const validation = await validateAdminUserInput(input, createValidationContext(repos, clock, locale));
      if (!validation.ok) throw validationFailed(validation.errors);

      const value = validation.value;
      if (!value.password) {
        throw validationFailed([invalid('password', 'REQUIRED', locale, 'required')]);
      }

      const passwordHash = await hashPassword(value.password);

      let user: UserRow;
      try {
        user = await repos.users.insert({
          name: value.name,
          email: value.email,
          phoneNumber: value.phone_number,
          passwordHash,
          role: value.role,
          language: value.language,
          // Administrator-created staff accounts are usable immediately.
          isVerified: true,
        });
      } catch (error) {
        const message = String(error);
        if (/bar_council_id/i.test(message)) {
          throw validationFailed([
            {
              field: 'bar_council_id',
              code: 'UNIQUE',
              message: describe(locale, 'barCouncilUnique'),
            },
          ]);
        }
        if (/UNIQUE/i.test(message)) {
          throw validationFailed([invalid('email', 'UNIQUE', locale, 'emailUnique')]);
        }
        throw error;
      }

      await insertProfile(user.user_id, value);
      await audit(actorId, 'USER_CREATED', {
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      return toDto(user);
    },

    async update(actorId, userId, input, locale) {
      const user = await repos.users.findById(userId);
      if (!user) throw notFound(describe(locale, 'userNotFound'));

      const validation = validateAdminUserUpdate(input, createValidationContext(repos, clock, locale));
      if (!validation.ok) throw validationFailed(validation.errors);

      const patch = validation.value;
      if (patch.role && patch.role !== user.role) {
        if (actorId === userId) {
          throw new AppError('FORBIDDEN', describe(locale, 'cannotChangeOwnRole'));
        }

        if (!(await repos.users.hasRoleProfile(userId, patch.role))) {
          if (patch.role === 'Lawyer') {
            const taken = await repos.users.findLawyerByBarCouncilId(patch.bar_council_id ?? '');
            if (taken && taken.user_id !== userId) {
              throw validationFailed([
                {
                  field: 'bar_council_id',
                  code: 'UNIQUE',
                  message: describe(locale, 'barCouncilUnique'),
                },
              ]);
            }
            await repos.users.insertLawyer(userId, {
              barCouncilId: patch.bar_council_id ?? '',
            });
          } else if (patch.role === 'Curator') {
            await repos.users.insertCurator(userId, {});
          } else if (patch.role === 'Administrator') {
            await repos.users.insertAdministrator(userId, { adminLevel: 'Standard' });
          } else if (patch.role === 'API Manager') {
            await repos.users.insertApiManager(userId, {});
          } else {
            await repos.users.insertCitizen(userId, {});
          }
        }

        // Profile first, role second: a duplicate bar council id leaves the
        // account on its previous role instead of half-migrated.
        await repos.users.setRole(userId, patch.role);

        await audit(actorId, 'USER_ROLE_CHANGED', {
          userId,
          from: user.role,
          to: patch.role,
        });
      }

      if (patch.language && patch.language !== user.language) {
        await repos.users.setLanguage(userId, patch.language);
        await audit(actorId, 'USER_LANGUAGE_CHANGED', {
          userId,
          from: user.language,
          to: patch.language,
        });
      }

      const updated = await repos.users.findById(userId);
      if (!updated) throw notFound(describe(locale, 'userNotFound'));
      return toDto(updated);
    },
  };
}
