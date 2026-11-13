'use client';

/** Keyboard-friendly tab list. Panels stay in the owning component. */
export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-pill border border-line bg-surface p-1"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-ink'
            }`}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={`rounded-pill px-1.5 text-xs ${
                  active ? 'bg-primary-foreground/20' : 'bg-canvas text-muted'
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
