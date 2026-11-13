import type { ReactNode } from 'react';

import { RoleLayout } from '@/features/workspace/RoleLayout';

export default function ApiManagerLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="API Manager">{children}</RoleLayout>;
}
