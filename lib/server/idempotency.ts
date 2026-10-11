/* "Do this once": a double tap, a retry after a dropped connection, or a phone that
   resends a request must not place two orders (two bills, double stock taken, a promo
   counted twice). The browser sends one random key per order attempt; the server
   remembers the answer to that key and gives the same answer back.

   The key is mixed with a fingerprint of the request, so reusing a key for a
   *different* bag is a new order, not a stale answer. */

import { createHash } from 'node:crypto';
import { kv } from './store';

const KEY = /^[A-Za-z0-9_-]{16,80}$/;
const TTL = 15 * 60;

/** The header value if it looks like a key we would accept, else '' (the request then simply isn't deduplicated). */
export const idempotencyKey = (req: Request) => {
  const v = (req.headers.get('idempotency-key') || '').trim();
  return KEY.test(v) ? v : '';
};

const slot = (scope: string, key: string, fingerprint: string) =>
  `idem:${scope}:${createHash('sha256').update(`${key}\n${fingerprint}`).digest('base64url').slice(0, 32)}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn` once per (scope, key, fingerprint). A repeat while it is still running waits for it
 * (up to `waitMs`); a repeat after it finished returns the saved result. If `fn` throws, nothing
 * is kept, so the person can simply try again.
 */
export async function once<T>(scope: string, key: string, fingerprint: string, fn: () => Promise<T>, waitMs = 6000): Promise<{ value: T; replayed: boolean }> {
  if (!key) return { value: await fn(), replayed: false };
  const id = slot(scope, key, fingerprint);
  // A claim for work in progress is short: if the server dies mid-order, the retry must not be stuck behind it.
  const claimed = await kv.set(id, { state: 'running' }, { nx: true, ttlSec: 30 });
  if (claimed) {
    try {
      const value = await fn();
      await kv.set(id, { state: 'done', value }, { ttlSec: TTL });
      return { value, replayed: false };
    } catch (e) {
      await kv.del(id);
      throw e;
    }
  }
  for (let waited = 0; waited <= waitMs; waited += 150) {
    const saved = await kv.get<{ state: 'running' | 'done'; value?: T }>(id);
    if (!saved) return once(scope, key, fingerprint, fn, 0); // the first attempt failed and cleared its claim: take over
    if (saved.state === 'done') return { value: saved.value as T, replayed: true };
    await wait(150);
  }
  const { HttpError } = await import('./http');
  throw new HttpError(409, 'Your order is still being placed. Give it a moment before trying again.');
}
