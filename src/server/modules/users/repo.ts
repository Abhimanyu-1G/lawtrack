import 'server-only';

import { sql, type Kysely, type Selectable } from 'kysely';

import type { AdminLevel, Language, LawyerStatus, UserRole } from '../../../shared/enums';
import type { Database, UserTable } from '../../db/schema';
import { normalisePagination, type PageParams } from '../../db/query';

export type UserRow = Selectable<UserTable>;

export interface NewUser {
  name: string;
  email: string;
  phoneNumber?: string | null;
  passwordHash: string;
  role: UserRole;
  language: Language;
  isVerified?: boolean;
}

export interface UserListFilter {
  role?: UserRole;
  query?: string;
  page?: string | number | null;
  pageSize?: string | number | null;
}

export interface UserListResult {
  items: UserRow[];
  total: number;
  page: PageParams;
}

/**
 * User persistence. Repositories own SQL only — no authorisation, no hashing,
 * no business rules. The email lookup is case-insensitive to match the unique
 * index created in migration 0001.
 */
export function createUsersRepo(db: Kysely<Database>) {
  return {
    async findByEmail(email: string): Promise<UserRow | undefined> {
      return db
        .selectFrom('User')
        .selectAll()
        .where(sql<boolean>`email = ${email} COLLATE NOCASE`)
        .executeTakeFirst();
    },

    async findById(userId: number): Promise<UserRow | undefined> {
      return db.selectFrom('User').selectAll().where('user_id', '=', userId).executeTakeFirst();
    },

    async insert(input: NewUser): Promise<UserRow> {
      return db
        .insertInto('User')
        .values({
          name: input.name,
          email: input.email,
          phone_number: input.phoneNumber ?? null,
          password_hash: input.passwordHash,
          role: input.role,
          language: input.language,
          is_verified: input.isVerified ? 1 : 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async setVerified(userId: number): Promise<void> {
      await db.updateTable('User').set({ is_verified: 1 }).where('user_id', '=', userId).execute();
    },

    async setLanguage(userId: number, language: Language): Promise<void> {
      await db.updateTable('User').set({ language }).where('user_id', '=', userId).execute();
    },

    async updateProfile(
      userId: number,
      input: { name?: string; phoneNumber?: string | null; language?: Language },
    ): Promise<void> {
      const patch: { name?: string; phone_number?: string | null; language?: Language } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.phoneNumber !== undefined) patch.phone_number = input.phoneNumber;
      if (input.language !== undefined) patch.language = input.language;
      if (Object.keys(patch).length === 0) return;

      await db.updateTable('User').set(patch).where('user_id', '=', userId).execute();
    },

    async exists(userId: number): Promise<boolean> {
      const row = await db
        .selectFrom('User')
        .select('user_id')
        .where('user_id', '=', userId)
        .executeTakeFirst();
      return row !== undefined;
    },

    async list(filter: UserListFilter = {}): Promise<UserListResult> {
      const page = normalisePagination(filter.page, filter.pageSize);

      let base = db.selectFrom('User');
      if (filter.role) base = base.where('role', '=', filter.role);
      if (filter.query) {
        const pattern = `%${filter.query.trim()}%`;
        base = base.where((eb) => eb.or([eb('name', 'like', pattern), eb('email', 'like', pattern)]));
      }

      const items = await base
        .selectAll()
        .orderBy('user_id', 'desc')
        .limit(page.pageSize)
        .offset(page.offset)
        .execute();

      const countRow = await base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirst();

      return { items, total: Number(countRow?.total ?? 0), page };
    },

    // ---- role profiles -------------------------------------------------
    async insertCitizen(userId: number, input: { address?: string | null; state?: string | null }) {
      await db
        .insertInto('Citizen')
        .values({
          user_id: userId,
          address: input.address ?? null,
          state: input.state ?? null,
        })
        .execute();
    },

    async findCitizen(userId: number) {
      return db.selectFrom('Citizen').selectAll().where('user_id', '=', userId).executeTakeFirst();
    },

    /** Whether the role-specific profile row already exists (role changes). */
    async hasRoleProfile(userId: number, role: UserRole): Promise<boolean> {
      if (role === 'Citizen') return (await this.findCitizen(userId)) !== undefined;
      if (role === 'Lawyer') {
        return (
          (await db
            .selectFrom('Legal_Aid_Lawyer')
            .select('user_id')
            .where('user_id', '=', userId)
            .executeTakeFirst()) !== undefined
        );
      }
      if (role === 'Curator') {
        return (
          (await db
            .selectFrom('Content_Curator')
            .select('user_id')
            .where('user_id', '=', userId)
            .executeTakeFirst()) !== undefined
        );
      }
      if (role === 'Administrator') {
        return (
          (await db
            .selectFrom('System_Administrator')
            .select('user_id')
            .where('user_id', '=', userId)
            .executeTakeFirst()) !== undefined
        );
      }
      return (
        (await db
          .selectFrom('API_Integration_Manager')
          .select('user_id')
          .where('user_id', '=', userId)
          .executeTakeFirst()) !== undefined
      );
    },

    /** Bar council ids are unique across lawyers (ER constraint). */
    async findLawyerByBarCouncilId(barCouncilId: string) {
      return db
        .selectFrom('Legal_Aid_Lawyer')
        .selectAll()
        .where('bar_council_id', '=', barCouncilId)
        .executeTakeFirst();
    },

    async findLawyerProfile(userId: number) {
      return db
        .selectFrom('Legal_Aid_Lawyer')
        .selectAll()
        .where('user_id', '=', userId)
        .executeTakeFirst();
    },

    async insertLawyer(
      userId: number,
      input: {
        barCouncilId: string;
        specialization?: string | null;
        experienceYears?: number | null;
        status?: LawyerStatus;
      },
    ) {
      await db
        .insertInto('Legal_Aid_Lawyer')
        .values({
          user_id: userId,
          bar_council_id: input.barCouncilId,
          specialization: input.specialization ?? null,
          experience_years: input.experienceYears ?? null,
          ...(input.status ? { status: input.status } : {}),
        })
        .execute();
    },

    async insertCurator(userId: number, input: { expertise?: string | null }) {
      await db
        .insertInto('Content_Curator')
        .values({ user_id: userId, expertise: input.expertise ?? null })
        .execute();
    },

    async insertAdministrator(
      userId: number,
      input: { adminLevel?: AdminLevel; lastLogin?: string | null } = {},
    ) {
      await db
        .insertInto('System_Administrator')
        .values({
          user_id: userId,
          ...(input.adminLevel ? { admin_level: input.adminLevel } : {}),
          last_login: input.lastLogin ?? null,
        })
        .execute();
    },

    async insertApiManager(userId: number, input: { managedServices?: string | null }) {
      await db
        .insertInto('API_Integration_Manager')
        .values({
          user_id: userId,
          managed_services: input.managedServices ?? null,
        })
        .execute();
    },

    async setLawyerStatus(userId: number, status: LawyerStatus): Promise<void> {
      await db.updateTable('Legal_Aid_Lawyer').set({ status }).where('user_id', '=', userId).execute();
    },

    async setRole(userId: number, role: UserRole): Promise<void> {
      await db.updateTable('User').set({ role }).where('user_id', '=', userId).execute();
    },

    /** Active accounts for a role, used for fan-out notifications. */
    async idsByRole(role: UserRole): Promise<number[]> {
      const rows = await db
        .selectFrom('User')
        .select('user_id')
        .where('role', '=', role)
        .execute();
      return rows.map((row) => row.user_id);
    },

    /** Lawyers who are currently Available, with their UI language. */
    async availableLawyers(): Promise<{ userId: number; language: Language }[]> {
      const rows = await db
        .selectFrom('Legal_Aid_Lawyer')
        .innerJoin('User', 'User.user_id', 'Legal_Aid_Lawyer.user_id')
        .select(['Legal_Aid_Lawyer.user_id as user_id', 'User.language as language'])
        .where('Legal_Aid_Lawyer.status', '=', 'Available')
        .execute();

      return rows.map((row) => ({ userId: row.user_id, language: row.language }));
    },

    /** Accounts of one role with their UI language (notification fan-out). */
    async usersByRole(role: UserRole): Promise<{ userId: number; language: Language }[]> {
      const rows = await db
        .selectFrom('User')
        .select(['user_id', 'language'])
        .where('role', '=', role)
        .execute();

      return rows.map((row) => ({ userId: row.user_id, language: row.language }));
    },

    async recordAdminLogin(userId: number, at: string): Promise<void> {
      await db
        .updateTable('System_Administrator')
        .set({ last_login: at })
        .where('user_id', '=', userId)
        .execute();
    },
  };
}

export type UsersRepo = ReturnType<typeof createUsersRepo>;
