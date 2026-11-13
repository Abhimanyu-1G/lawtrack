import type { ReactNode } from 'react';

import { RoleLayout } from '@/features/workspace/RoleLayout';

export default function CuratorLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="Curator">{children}</RoleLayout>;
}
