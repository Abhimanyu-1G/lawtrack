import type { GuideStatus } from '../../shared/enums';
import type { Dictionary } from '../../i18n';

const TONES: Record<GuideStatus, string> = {
  Draft: 'border-warning/30 bg-warning-tint text-warning',
  Valid: 'border-success/30 bg-success-tint text-success',
  'Requires AI Update': 'border-danger/30 bg-danger-tint text-danger',
};

const LABEL_KEYS: Record<GuideStatus, 'statusDraft' | 'statusValid' | 'statusRequires'> = {
  Draft: 'statusDraft',
  Valid: 'statusValid',
  'Requires AI Update': 'statusRequires',
};

/** Status pill. Colour is always paired with the localised label (AGENTS.md §15). */
export function GuideStatusBadge({ status, dict }: { status: GuideStatus; dict: Dictionary }) {
  const label = dict.curator[LABEL_KEYS[status]];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[0.7rem] font-semibold ${TONES[status]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-current" />
      {label}
    </span>
  );
}
