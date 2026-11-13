import type { ReactNode } from 'react';

import { RoleLayout } from '@/features/workspace/RoleLayout';

export default function CitizenLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="Citizen">{children}</RoleLayout>;
}
