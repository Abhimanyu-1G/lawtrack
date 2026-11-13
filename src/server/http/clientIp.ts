import 'server-only';

/** Best-effort client IP for rate limiting (proxy header, then loopback). */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : '127.0.0.1';
}
