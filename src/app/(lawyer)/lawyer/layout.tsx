import type { ReactNode } from 'react';

import { RoleLayout } from '@/features/workspace/RoleLayout';

export default function LawyerLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="Lawyer">{children}</RoleLayout>;
}
