import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-team-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let team: typeof import('@/lib/server/team');
let auth: typeof import('@/lib/server/auth');
let settings: typeof import('@/lib/server/settings');

beforeAll(async () => {
  team = await import('@/lib/server/team');
  auth = await import('@/lib/server/auth');
  settings = await import('@/lib/server/settings');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const { permsFor } = await import('@/lib/rbac');
const member = async (role: 'owner' | 'manager' | 'waiter', shops: number[], email: string) =>
  auth.saveUser(auth.newUser({ kind: 'staff', role, name: `${role} ${email}`, email, shops, passHash: 'x' }));
const ctxOf = async (u: Awaited<ReturnType<typeof member>>) => ({ user: u, role: u.role as 'owner' | 'manager', perms: permsFor(u.role as 'manager'), settings: await settings.getSettings() });

describe('editMember', () => {
  it('keeps a manager tied to one shop away from people at other shops', async () => {
    const manager = await ctxOf(await member('manager', [0], 'm0@brewns.test'));
    const there = await member('waiter', [1], 'w1@brewns.test');
    const everywhere = await member('waiter', [], 'wall@brewns.test');
    const here = await member('waiter', [0], 'w0@brewns.test');
    await expect(team.editMember(manager, there.id, { active: false })).rejects.toThrow(/your shops/);
    await expect(team.editMember(manager, everywhere.id, { reset: true })).rejects.toThrow(/your shops/);
    const done = await team.editMember(manager, here.id, { active: false });
    expect(done.user?.active).toBe(false);
  });

  it('lets an owner change anyone', async () => {
    const owner = await ctxOf(await member('owner', [], 'o@brewns.test'));
    const there = await member('waiter', [1], 'w1b@brewns.test');
    expect((await team.editMember(owner, there.id, { name: 'Ali Raza' })).user?.name).toBe('Ali Raza');
  });

  it('never hands someone a password link for their own account (it would skip their current password)', async () => {
    const owner = await ctxOf(await member('owner', [], 'o2@brewns.test'));
    await expect(team.editMember(owner, owner.user.id, { reset: true })).rejects.toThrow(/My account/);
  });
});

describe('staff sign-up', () => {
  it('answers the same for a new email and one already on the team, so nobody can find out who works here', async () => {
    const { POST } = await import('@/app/api/auth/staff-signup/route');
    const ask = () =>
      POST(new Request('http://localhost/api/auth/staff-signup', { method: 'POST', body: JSON.stringify({ name: 'Sara Khan', email: 'sara@brewns.test', password: 'coffee123', role: 'barista' }) }));
    const first = await ask();
    const again = await ask();
    expect(first.status).toBe(201);
    expect(again.status).toBe(first.status);
    expect(await again.json()).toEqual(await first.json());
    expect((await auth.allUsers('staff')).filter((u) => u.email === 'sara@brewns.test')).toHaveLength(1);
  });
});
