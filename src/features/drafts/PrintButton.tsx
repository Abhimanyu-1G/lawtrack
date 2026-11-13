'use client';

import { Button } from '../../components/ui/Button';

/** Browser print button for the standalone draft print view. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
