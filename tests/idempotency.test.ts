import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-idem-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let idem: typeof import('@/lib/server/idempotency');
beforeAll(async () => {
  idem = await import('@/lib/server/idempotency');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const KEY = 'a1b2c3d4e5f6a7b8c9d0';
const req = (key?: string) => new Request('http://x/api/orders', { method: 'POST', headers: key === undefined ? {} : { 'idempotency-key': key } });

describe('idempotencyKey', () => {
  it('accepts a normal key and ignores anything odd', () => {
    expect(idem.idempotencyKey(req(KEY))).toBe(KEY);
    expect(idem.idempotencyKey(req())).toBe('');
    expect(idem.idempotencyKey(req('short'))).toBe('');
    expect(idem.idempotencyKey(req('has spaces in it, and is long enough'))).toBe('');
    expect(idem.idempotencyKey(req('x'.repeat(200)))).toBe('');
  });
});

describe('once', () => {
  it('runs every time when there is no key', async () => {
    let n = 0;
    await idem.once('t', '', 'body', async () => ++n);
    await idem.once('t', '', 'body', async () => ++n);
    expect(n).toBe(2);
  });

  it('runs once for the same key and request, and hands back the first answer', async () => {
    let n = 0;
    const a = await idem.once('t', KEY + 'a', 'body', async () => ({ number: ++n }));
    const b = await idem.once('t', KEY + 'a', 'body', async () => ({ number: ++n }));
    expect(n).toBe(1);
    expect(a).toEqual({ value: { number: 1 }, replayed: false });
    expect(b).toEqual({ value: { number: 1 }, replayed: true });
  });

  it('two taps at the same moment still make one order', async () => {
    let n = 0;
    const slow = async () => {
      await new Promise((r) => setTimeout(r, 120));
      return { number: ++n };
    };
    const [a, b] = await Promise.all([idem.once('t', KEY + 'b', 'body', slow), idem.once('t', KEY + 'b', 'body', slow)]);
    expect(n).toBe(1);
    expect(a.value).toEqual(b.value);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
  });

  it('treats a different request under the same key as a new one', async () => {
    let n = 0;
    await idem.once('t', KEY + 'c', 'one latte', async () => ++n);
    await idem.once('t', KEY + 'c', 'two lattes', async () => ++n);
    expect(n).toBe(2);
  });

  it('keeps nothing when it fails, so trying again works', async () => {
    let n = 0;
    await expect(
      idem.once('t', KEY + 'd', 'body', async () => {
        n++;
        throw new Error('sold out');
      }),
    ).rejects.toThrow('sold out');
    const again = await idem.once('t', KEY + 'd', 'body', async () => ++n);
    expect(again.replayed).toBe(false);
    expect(n).toBe(2);
  });

  it('keeps scopes apart', async () => {
    let n = 0;
    await idem.once('orders', KEY + 'e', 'body', async () => ++n);
    await idem.once('bookings', KEY + 'e', 'body', async () => ++n);
    expect(n).toBe(2);
  });
});
