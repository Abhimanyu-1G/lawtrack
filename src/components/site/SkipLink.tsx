/** Skip link, rendered per page so its label follows the active language. */
export function SkipLink({ label }: { label: string }) {
  return (
    <a href="#main-content" className="skip-link">
      {label}
    </a>
  );
}
