import type { HTMLAttributes, ReactNode } from 'react';

/** Flat ivory card with a hairline border and very soft shadow (AGENTS.md §15). */
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-card border border-line bg-surface shadow-soft ${className}`}
    />
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`border-b border-line px-5 py-4 sm:px-6 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 sm:px-6 ${className}`}>{children}</div>;
}

export function CardTitle({
  children,
  as: Tag = 'h2',
  className = '',
}: {
  children: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return <Tag className={`font-serif text-xl leading-snug text-ink ${className}`}>{children}</Tag>;
}
