import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_ROLE_PERMS } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.SMTP_USER;
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;

let tm: typeof import('@/lib/server/teamMessages');
const person = (id: string, role: string, shops: number[]) => ({ id, name: `${role} ${id}`, role, shops, active: true, passHash: 'x', email: `${id}@example.com` }) as never;
const ctx = (u: { id: string; role: string; shops: number[] }) => ({ user: u, role: u.role, perms: DEFAULT_ROLE_PERMS[u.role as 'manager'] || [], settings: {} }) as never;

const owner = person('o1', 'owner', []);
const mmManager = person('m1', 'manager', [0]);
const mmBarista = person('b1', 'barista', [0]);
const dhaRider = person('r1', 'rider', [1]);

beforeAll(async () => {
  tm = await import('@/lib/server/teamMessages');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('team messages', () => {
  it("the owner's message reaches everyone; a shop manager's reaches that shop's people", async () => {
    await tm.postMessage(ctx(owner), { text: 'Team meeting Friday 9am.' });
    await tm.postMessage(ctx(mmManager), { text: 'MM Alam: new milk supplier from Monday.' });
    const barista = await tm.messagesFor(mmBarista);
    const rider = await tm.messagesFor(dhaRider);
    expect(barista.messages.map((m) => m.text)).toEqual(['MM Alam: new milk supplier from Monday.', 'Team meeting Friday 9am.']);
    expect(rider.messages.map((m) => m.text)).toEqual(['Team meeting Friday 9am.']);
    expect(barista.unread).toBe(2);
    // your own message doesn't count as unread
    expect((await tm.messagesFor(owner)).unread).toBe(1);
  });

  it('opening them clears the unread count', async () => {
    await tm.markRead(mmBarista);
    expect((await tm.messagesFor(mmBarista)).unread).toBe(0);
  });

  it('keeps the text tidy and refuses an empty one', async () => {
    const m = await tm.postMessage(ctx(owner), { text: '  Line one\r\n\n\n\nLine two  ' });
    expect(m.text).toBe('Line one\n\nLine two');
    let status = 0;
    await tm.postMessage(ctx(owner), { text: ' ' }).catch((e) => (status = e.status));
    expect(status).toBe(400);
  });
});
