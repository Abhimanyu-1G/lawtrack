import 'server-only';

import { AppError } from '../lib/errors';

// Shared parsing for draft route handlers.
export interface DraftRouteContext {
  params: Promise<{ id: string }>;
}

export async function draftIdFromContext(context: DraftRouteContext): Promise<number> {
  const { id } = await context.params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId < 1) {
    throw new AppError('NOT_FOUND', 'Draft not found');
  }
  return draftId;
}
