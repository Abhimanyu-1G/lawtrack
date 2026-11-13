import 'server-only';

import { AppError } from '../lib/errors';

// Shared parsing for guide detail route handlers.
export interface GuideRouteContext {
  params: Promise<{ id: string }>;
}

export function parseGuideId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError('NOT_FOUND', 'Guide not found');
  }
  return id;
}

export async function guideIdFromContext(context: GuideRouteContext): Promise<number> {
  const { id } = await context.params;
  return parseGuideId(id);
}
