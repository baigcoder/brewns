import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-team-scope-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let auth: typeof import('@/lib/server/auth');
let team: typeof import('@/lib/server/team');

beforeAll(async () => {
  auth = await import('@/lib/server/auth');
  team = await import('@/lib/server/team');
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('team directory shop scope', () => {
  it('hides other-shop and all-shop staff from a shop-scoped manager', async () => {
    const manager = auth.newUser({ kind: 'staff', role: 'manager', name: 'Shop Zero Manager', email: 'manager@example.test', shops: [0] });
    const local = auth.newUser({ kind: 'staff', role: 'waiter', name: 'Shop Zero Waiter', email: 'local@example.test', shops: [0] });
    const other = auth.newUser({ kind: 'staff', role: 'waiter', name: 'Shop One Waiter', email: 'other@example.test', shops: [1] });
    const allShops = auth.newUser({ kind: 'staff', role: 'waiter', name: 'All Shops Waiter', email: 'all@example.test', shops: [] });
    await Promise.all([auth.saveUser(manager), auth.saveUser(local), auth.saveUser(other), auth.saveUser(allShops)]);

    const visible = await team.listTeam({ user: manager, role: 'manager' } as never);

    expect(visible.map((member) => member.id)).toEqual(expect.arrayContaining([manager.id, local.id]));
    expect(visible.map((member) => member.id)).not.toEqual(expect.arrayContaining([other.id, allShops.id]));
  });
});
