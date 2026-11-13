import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/** Scrollable data table with a caption and consistent hairlines. */
export function Table({
  children,
  caption,
  className = '',
}: {
  children: ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-card border border-line bg-surface">
      <table className={`w-full border-collapse text-left text-sm ${className}`}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={`bg-canvas/70 text-xs uppercase tracking-wide text-muted ${props.className ?? ''}`} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={`divide-y divide-line ${props.className ?? ''}`} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={`align-top ${props.className ?? ''}`} />;
}

export function TableHeaderCell({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...props} scope={props.scope ?? 'col'} className={`px-4 py-3 font-semibold ${props.className ?? ''}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className={`px-4 py-3 text-ink ${props.className ?? ''}`}>
      {children}
    </td>
  );
}
