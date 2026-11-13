import 'server-only';

import { AppError } from '../lib/errors';

// Shared parsing for chat session route handlers.
export interface ChatSessionRouteContext {
  params: Promise<{ id: string }>;
}

export async function chatSessionIdFromContext(
  context: ChatSessionRouteContext,
): Promise<number> {
  const { id } = await context.params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    throw new AppError('NOT_FOUND', 'Chat session not found');
  }
  return sessionId;
}
