import type { Dictionary } from '../../i18n';
import type { UserRole } from '../../shared/enums';
import type { SessionClaims } from '../../shared/session';
import { AccountCard } from './AccountCard';

const AREA_COPY: Record<UserRole, keyof Dictionary['workspace']> = {
  Citizen: 'areaCitizen',
  Lawyer: 'areaLawyer',
  Curator: 'areaCurator',
  Administrator: 'areaAdmin',
  'API Manager': 'areaApiManager',
};

const NEXT_COPY: Record<UserRole, keyof Dictionary['workspace']> = {
  Citizen: 'nextCitizen',
  Lawyer: 'nextLawyer',
  Curator: 'nextCurator',
  Administrator: 'nextAdmin',
  'API Manager': 'nextApiManager',
};

/**
 * Landing screen for roles whose area is still being built. It states who is
 * signed in, what the area will hold, and the account details the session
 * actually knows — honest copy, no fake metrics or dead buttons.
 */
export function RoleOverview({ session, dict }: { session: SessionClaims; dict: Dictionary }) {
  const roleLabel = dict.roles[session.role];
  const area = dict.workspace[AREA_COPY[session.role]];
  const next = dict.workspace[NEXT_COPY[session.role]];

  return (
    <div className="max-w-3xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.workspace.signedInAs.replace('{{role}}', roleLabel)}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
        {dict.workspace.welcome.replace('{{name}}', session.name)}
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">
        {dict.workspace.preparingBody.replace('{{area}}', area)}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-lg">{dict.workspace.nextTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{next}</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-pill bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-primary" />
            {dict.workspace.preparingTitle}
          </p>
        </section>

        <AccountCard session={session} dict={dict} />
      </div>

      <p className="mt-8 text-xs leading-5 text-muted">{dict.workspace.prototypeNote}</p>
    </div>
  );
}
