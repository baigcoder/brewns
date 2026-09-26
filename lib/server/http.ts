/* Small helpers every API route uses: JSON replies, errors, the same-origin
   check that keeps other sites from posting with a signed-in visitor's cookie,
   reading a body safely, and rate limits. */

import { kv } from './store';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export const fail = (status: number, message: string) => {
  throw new HttpError(status, message);
};

/** Wraps a route: HttpErrors become their status, anything else a logged 500. Mutations must come from this site. */
export function route<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') checkOrigin(req);
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[brewns api]', e);
      return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
    }
  };
}

/** A browser always sends Origin on a cross-site POST; if it names another site, refuse. */
function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  let from = '';
  try {
    from = new URL(origin).host;
  } catch {}
  if (!host || from !== host) fail(403, 'Requests must come from this site.');
}

export async function readBody<T = Record<string, unknown>>(req: Request, maxBytes = 64_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) fail(413, 'That is too much to send at once.');
  if (!text) return {} as T;
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object') throw new Error();
    return v as T;
  } catch {
    return fail(400, 'Send JSON.') as never;
  }
}

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';

/** At most `max` hits per `windowSec` for this key; throws 429 past it. */
export async function rateLimit(key: string, max: number, windowSec: number, message = 'Too many tries. Wait a few minutes and try again.') {
  const n = await kv.incr(`rl:${key}`, windowSec);
  if (n > max) fail(429, message);
}

/* ── field checks ── */

export const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const normEmail = (v: unknown) => str(v, 120).toLowerCase();
