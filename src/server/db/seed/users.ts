import 'server-only';

import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import type { UserRole } from '../../../shared/enums';
import type { Repositories } from '../../db/repositories';
import type { UserRow } from '../../modules/users/repo';

/**
 * Account seeding.
 *
 * Two non-login system accounts are created:
 *  - `system@lawtrack.local` — actor for automated Audit_Log entries.
 *  - `system.integrations@lawtrack.local` — owner of the seeded API_Integration
 *    rows, so integrations exist even when demo accounts are skipped in
 *    production (they need a real API_Integration_Manager to point at).
 *
 * Demo accounts are refused when NODE_ENV=production (AGENTS.md §4).
 */

export const DEMO_PASSWORD = 'Demo1234';
export const BCRYPT_COST = 12;

export const SYSTEM_USER_EMAIL = 'system@lawtrack.local';
export const SYSTEM_INTEGRATIONS_EMAIL = 'system.integrations@lawtrack.local';

interface UserSpec {
  label: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: UserRole;
  verified: boolean;
  /** Plain password for demo users; system users get an unusable random hash. */
  password: string | null;
  insertProfile?: (userId: number) => Promise<void>;
}

export interface EnsuredUser {
  user: UserRow;
  created: boolean;
}

async function ensureUser(repos: Repositories, spec: UserSpec): Promise<EnsuredUser> {
  const existing = await repos.users.findByEmail(spec.email);
  if (existing) return { user: existing, created: false };

  const secret = spec.password ?? randomUUID();
  const passwordHash = await bcrypt.hash(secret, BCRYPT_COST);

  const user = await repos.users.insert({
    name: spec.name,
    email: spec.email,
    phoneNumber: spec.phoneNumber,
    passwordHash,
    role: spec.role,
    language: 'English',
    isVerified: spec.verified,
  });

  if (spec.insertProfile) await spec.insertProfile(user.user_id);

  return { user, created: true };
}

export interface SeededAccounts {
  systemUser: UserRow;
  systemApiManager: UserRow;
  curator: UserRow | undefined;
  createdLabels: string[];
}

export const DEMO_ACCOUNT_EMAILS = [
  'citizen@lawtrack.demo',
  'lawyer@lawtrack.demo',
  'curator@lawtrack.demo',
  'admin@lawtrack.demo',
  'apimanager@lawtrack.demo',
] as const;

export async function seedAccounts(
  repos: Repositories,
  options: { includeDemoAccounts: boolean },
): Promise<SeededAccounts> {
  const createdLabels: string[] = [];

  const systemSpec: UserSpec = {
    label: 'system',
    name: 'LawTrack System',
    email: SYSTEM_USER_EMAIL,
    phoneNumber: null,
    role: 'Administrator',
    verified: false,
    password: null,
    insertProfile: async (userId) => {
      await repos.users.insertAdministrator(userId, { adminLevel: 'Super' });
    },
  };

  const systemManagerSpec: UserSpec = {
    label: 'system-integrations',
    name: 'System Integration Manager',
    email: SYSTEM_INTEGRATIONS_EMAIL,
    phoneNumber: null,
    role: 'API Manager',
    verified: false,
    password: null,
    insertProfile: async (userId) => {
      await repos.users.insertApiManager(userId, {
        managedServices: 'eCourts, Gemini, India Code, OTP Gateway',
      });
    },
  };

  const system = await ensureUser(repos, systemSpec);
  if (system.created) createdLabels.push(systemSpec.label);

  const systemManager = await ensureUser(repos, systemManagerSpec);
  if (systemManager.created) createdLabels.push(systemManagerSpec.label);

  let curator: UserRow | undefined;

  if (options.includeDemoAccounts) {
    const demoSpecs: UserSpec[] = [
      {
        label: 'citizen',
        name: 'Ananya Sharma',
        email: 'citizen@lawtrack.demo',
        phoneNumber: '9876543210',
        role: 'Citizen',
        verified: true,
        password: DEMO_PASSWORD,
        insertProfile: async (userId) => {
          await repos.users.insertCitizen(userId, {
            address: '14, Civil Lines, Jaipur',
            state: 'Rajasthan',
          });
        },
      },
      {
        label: 'lawyer',
        name: 'Rohit Mehta',
        email: 'lawyer@lawtrack.demo',
        phoneNumber: '9812345670',
        role: 'Lawyer',
        verified: true,
        password: DEMO_PASSWORD,
        insertProfile: async (userId) => {
          await repos.users.insertLawyer(userId, {
            barCouncilId: 'RJ/1234/2015',
            specialization: 'Consumer, Tenancy & Criminal Law',
            experienceYears: 9,
            status: 'Available',
          });
        },
      },
      {
        label: 'curator',
        name: 'Meera Iyer',
        email: 'curator@lawtrack.demo',
        phoneNumber: '9823456781',
        role: 'Curator',
        verified: true,
        password: DEMO_PASSWORD,
        insertProfile: async (userId) => {
          await repos.users.insertCurator(userId, { expertise: 'Consumer, Tenancy & RTI' });
        },
      },
      {
        label: 'admin',
        name: 'Aditya Rao',
        email: 'admin@lawtrack.demo',
        phoneNumber: '9834567892',
        role: 'Administrator',
        verified: true,
        password: DEMO_PASSWORD,
        insertProfile: async (userId) => {
          await repos.users.insertAdministrator(userId, { adminLevel: 'Super' });
        },
      },
      {
        label: 'api-manager',
        name: 'Kavya Nair',
        email: 'apimanager@lawtrack.demo',
        phoneNumber: '9845678903',
        role: 'API Manager',
        verified: true,
        password: DEMO_PASSWORD,
        insertProfile: async (userId) => {
          await repos.users.insertApiManager(userId, {
            managedServices: 'eCourts, Gemini, India Code, OTP Gateway',
          });
        },
      },
    ];

    for (const spec of demoSpecs) {
      const ensured = await ensureUser(repos, spec);
      if (ensured.created) createdLabels.push(spec.label);
      if (spec.label === 'curator') curator = ensured.user;
    }
  } else {
    // Curator may still exist from an earlier non-production seed.
    const existingCurator = await repos.users.findByEmail('curator@lawtrack.demo');
    curator = existingCurator;
  }

  return {
    systemUser: system.user,
    systemApiManager: systemManager.user,
    curator,
    createdLabels,
  };
}
