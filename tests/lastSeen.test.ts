import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-seen-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let auth: typeof import('@/lib/server/auth');
let store: typeof import('@/lib/server/store');
beforeAll(async () => {
  auth = await import('@/lib/server/auth');
  store = await import('@/lib/server/store');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('last seen', () => {
  it('is kept apart from the account and laid over it when people are listed', async () => {
    const u = auth.newUser({ kind: 'staff', role: 'barista', name: 'Ali', email: 'ali@example.test' });
    await auth.saveUser(u);
    await store.kv.hset('seen', u.id, 1_700_000_000_000);
    const listed = (await auth.allUsers('staff')).find((x) => x.id === u.id)!;
    expect(listed.lastSeenAt).toBe(1_700_000_000_000);
    // The account itself is untouched, so a stale copy can never write an old "active" or role back.
    expect((await auth.getUser(u.id))!.lastSeenAt).toBe(0);
  });

  it('goes when the account goes', async () => {
    const u = auth.newUser({ kind: 'staff', role: 'barista', name: 'Bo', email: 'bo@example.test' });
    await auth.saveUser(u);
    await store.kv.hset('seen', u.id, 5);
    await auth.deleteUser(u);
    expect(await store.kv.hget('seen', u.id)).toBeNull();
  });
});
