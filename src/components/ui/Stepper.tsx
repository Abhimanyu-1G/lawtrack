/** Horizontal progress stepper; state is also announced in text. */
export type StepState = 'done' | 'current' | 'upcoming';

export interface Step {
  label: string;
  description?: string;
  state: StepState;
}

const DOT: Record<StepState, string> = {
  done: 'border-primary bg-primary text-primary-foreground',
  current: 'border-primary bg-surface text-primary',
  upcoming: 'border-line bg-surface text-muted',
};

export function Stepper({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-3 sm:flex-row sm:gap-2">
      {steps.map((step, index) => (
        <li key={step.label} className="flex flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold ${DOT[step.state]}`}
          >
            {step.state === 'done' ? '✓' : index + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">{step.label}</span>
            {step.description ? (
              <span className="mt-0.5 block text-xs leading-5 text-muted">{step.description}</span>
            ) : null}
            <span className="sr-only">
              {step.state === 'done' ? 'completed' : step.state === 'current' ? 'current step' : 'upcoming'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
