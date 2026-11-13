import type { ReactNode } from 'react';

import { RoleLayout } from '@/features/workspace/RoleLayout';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="Administrator">{children}</RoleLayout>;
}
