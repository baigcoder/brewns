import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-hint-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let settings: typeof import('@/lib/server/settings');
let store: typeof import('@/lib/server/store');
let auth: typeof import('@/lib/server/auth');
let status: typeof import('@/app/api/public/status/route');
beforeAll(async () => {
  settings = await import('@/lib/server/settings');
  store = await import('@/lib/server/store');
  auth = await import('@/lib/server/auth');
  status = await import('@/app/api/public/status/route');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const promo = (code: string, extra = {}) => ({ code, pct: 20, active: true, uses: 0, createdAt: 1, ...extra });
const hintShown = async () => ((await (await status.GET(new Request('http://x/api/public/status'))).json()) as { promoHint: string }).promoHint;

describe('the promo code the site suggests', () => {
  it('is the flagged code, even when a private code comes first', async () => {
    await store.kv.set('settings', { promos: [promo('STAFF50'), promo('WELCOME', { hint: true })] });
    expect(await hintShown()).toBe('WELCOME');
  });

  it('is nothing when no code is flagged, so a private code is never exposed', async () => {
    await store.kv.set('settings', { promos: [promo('STAFF50'), promo('VIP30')] });
    expect(await hintShown()).toBe('');
  });

  it('is nothing while the flagged code is switched off', async () => {
    await store.kv.set('settings', { promos: [promo('WELCOME', { hint: true, active: false }), promo('STAFF50')] });
    expect(await hintShown()).toBe('');
  });

  it('keeps suggesting BREWNS10 for a café that set it up before the flag existed', async () => {
    await store.kv.set('settings', { promos: [promo('BREWNS10'), promo('STAFF50')] });
    const s = await settings.getSettings();
    expect(s.promos.find((p) => p.code === 'BREWNS10')?.hint).toBe(true);
    expect(s.promos.find((p) => p.code === 'STAFF50')?.hint).toBeUndefined();
    expect(await hintShown()).toBe('BREWNS10');
  });

  it('starts a fresh café with BREWNS10 suggested', async () => {
    expect(settings.defaultSettings().promos[0]).toMatchObject({ code: 'BREWNS10', hint: true });
    expect(typeof auth.ownerExists).toBe('function');
  });
});
