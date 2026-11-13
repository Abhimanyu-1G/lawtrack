import type { Dictionary } from '../../i18n';
import type { SessionClaims } from '../../shared/session';

/** Read-only account summary shared by every role home screen. */
export function AccountCard({ session, dict }: { session: SessionClaims; dict: Dictionary }) {
  const language = session.language === 'Hindi' ? dict.common.hindi : dict.common.english;

  const rows = [
    { label: dict.workspace.accountName, value: session.name },
    { label: dict.workspace.accountEmail, value: session.email },
    { label: dict.workspace.accountRole, value: dict.roles[session.role] },
    { label: dict.workspace.accountLanguage, value: language },
  ];

  return (
    <section className="rounded-card border border-line bg-surface p-6 shadow-soft">
      <h2 className="text-lg">{dict.workspace.accountTitle}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-line pb-2.5 last:border-0 last:pb-0"
          >
            <dt className="text-muted">{row.label}</dt>
            <dd className="max-w-[60%] break-words text-right font-medium text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
