import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_ROLE_PERMS } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let dm: typeof import('@/lib/server/directMessages');
const person = (id: string, role: string, shops: number[]) => ({ id, kind: 'staff', name: `${role} ${id}`, role, shops, active: true, passHash: 'x', email: `${id}@example.com` }) as never;
const ctx = (u: { id: string; role: string; shops: number[] }) => ({ user: u, role: u.role, perms: DEFAULT_ROLE_PERMS[u.role as 'manager'] || [], settings: {} }) as never;

const owner = person('o1', 'owner', []);
const barista = person('b1', 'barista', [0]);
const chef = person('c1', 'chef', [0]);
const rider = person('r1', 'rider', [1]);

beforeAll(async () => {
  const auth = await import('@/lib/server/auth');
  for (const u of [owner, barista, chef, rider]) await auth.saveUser(u);
  dm = await import('@/lib/server/directMessages');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('direct messages', () => {
  it('reaches only people who share a shop', async () => {
    expect((await dm.dmContacts(barista)).map((c) => c.id).sort()).toEqual(['c1', 'o1']);
    expect((await dm.dmContacts(owner)).map((c) => c.id).sort()).toEqual(['b1', 'c1', 'r1']);
    let status = 0;
    await dm.sendDm(ctx(barista), { to: 'r1', text: 'hi' }).catch((e) => (status = e.status));
    expect(status).toBe(404);
  });

  it('counts unread for the receiver only, and opening the conversation reads it', async () => {
    await dm.sendDm(ctx(barista), { to: 'c1', text: 'Out of oat milk?' });
    await dm.sendDm(ctx(barista), { to: 'c1', text: 'Need two cartons.' });
    const [chefThread] = await dm.dmThreads(chef);
    expect(chefThread).toMatchObject({ with: 'b1', unread: 2, last: 'Need two cartons.' });
    expect((await dm.dmThreads(barista))[0].unread).toBe(0);

    const msgs = await dm.dmConversation(chef, 'b1');
    expect(msgs.map((m) => m.text)).toEqual(['Out of oat milk?', 'Need two cartons.']);
    expect((await dm.dmThreads(chef))[0].unread).toBe(0);

    await dm.sendDm(ctx(chef), { to: 'b1', text: 'On it.' });
    expect((await dm.dmConversation(barista, 'c1')).map((m) => m.byId)).toEqual(['b1', 'b1', 'c1']);
  });

  it('keeps conversations private to the two people', async () => {
    expect(await dm.dmConversation(owner, 'b1')).toEqual([]);
    expect(await dm.dmThreads(owner)).toEqual([]);
  });

  it('refuses an empty message', async () => {
    let status = 0;
    await dm.sendDm(ctx(owner), { to: 'b1', text: '   ' }).catch((e) => (status = e.status));
    expect(status).toBe(400);
  });
});
