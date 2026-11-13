import 'server-only';

import { AppError } from '../lib/errors';

// Shared parsing for case route handlers.
export interface CaseRouteContext {
  params: Promise<{ id: string }>;
}

export async function caseIdFromContext(context: CaseRouteContext): Promise<number> {
  const { id } = await context.params;
  const caseId = Number(id);
  if (!Number.isInteger(caseId) || caseId < 1) {
    throw new AppError('NOT_FOUND', 'Case not found');
  }
  return caseId;
}
