import { getAuthService } from '@/server/modules/auth';
import { devOtpFor } from '@/server/http/devOtp';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/resend-otp — 60-second cooldown, neutral for unknown emails. */
async function resendOtp(request: Request): Promise<Response> {
  requireJsonContentType(request);
  const body = await readJsonBody(request);
  const result = await getAuthService().resendOtp(body, localeFromRequest(request));

  const record = typeof body === 'object' && body !== null ? (body as { email?: unknown }) : {};
  const devOtp = result.sent && typeof record.email === 'string' ? devOtpFor(record.email) : null;

  return jsonResponse({
    sent: result.sent,
    ...(result.retryAfterSeconds !== undefined ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
    ...(devOtp ? { devOtp } : {}),
  });
}

export const POST = withApiHandler(resendOtp, { name: 'POST /api/auth/resend-otp' });
