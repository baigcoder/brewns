import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-staffaccess-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;
delete process.env.SENDINBLUE_API_KEY;

let access: typeof import('@/lib/server/staffAccess');
let auth: typeof import('@/lib/server/auth');
let alerts: typeof import('@/lib/server/alerts');
let store: typeof import('@/lib/server/store');

beforeAll(async () => {
  access = await import('@/lib/server/staffAccess');
  auth = await import('@/lib/server/auth');
  alerts = await import('@/lib/server/alerts');
  store = await import('@/lib/server/store');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Runs a reset request and returns the link it would have emailed (it is printed to the log while developing). */
async function resetLinkFor(email: string): Promise<string> {
  let logged = '';
  const info = console.info;
  const warn = console.warn;
  console.info = (m: unknown) => void (logged += String(m));
  console.warn = () => {};
  try {
    await access.requestStaffReset(email, 'http://localhost:3000');
  } finally {
    console.info = info;
    console.warn = warn;
  }
  return logged.match(/https?:\/\/\S+/)?.[0] || '';
}

const joined = async (role: 'owner' | 'cashier', email: string, over: Partial<import('@/lib/server/auth').User> = {}) => {
  const u = auth.newUser({ kind: 'staff', role, name: `${role} person`, email, passHash: await auth.hashPassword('oldpass123'), ...over });
  await auth.saveUser(u);
  return u;
};

describe('staff password reset', () => {
  it('sends the owner a link that works once, lasts an hour, and matches what is stored', async () => {
    const owner = await joined('owner', 'owner@example.test');
    const link = await resetLinkFor('owner@example.test');
    expect(link).toMatch(/^http:\/\/localhost:3000\/staff\/invite\/[A-Za-z0-9_-]{20,}$/);
    const token = link.split('/').pop()!;
    const after = (await auth.getUser(owner.id))!;
    expect(after.invite?.hash).toBe(auth.sha256(token));
    const left = after.invite!.exp - Date.now();
    expect(left).toBeGreaterThan(55 * 60000);
    expect(left).toBeLessThanOrEqual(60 * 60000);
    expect(after.passHash).toBe(owner.passHash); // asking changes nothing until the link is used
    expect(after.v).toBe(owner.v);
  });

  it('replaces an older link with the newer one', async () => {
    await joined('cashier', 'zara@example.test');
    const first = (await resetLinkFor('zara@example.test')).split('/').pop()!;
    const second = (await resetLinkFor('zara@example.test')).split('/').pop()!;
    expect(first).not.toBe(second);
    const u = (await auth.findByEmail('staff', 'zara@example.test'))!;
    expect(u.invite?.hash).toBe(auth.sha256(second));
    expect(u.invite?.hash).not.toBe(auth.sha256(first));
  });

  it('says nothing, and sends nothing, for an email that is not on the team', async () => {
    expect(await resetLinkFor('nobody@example.test')).toBe('');
  });

  it('does not email a customer account that shares an address', async () => {
    const c = auth.newUser({ kind: 'customer', role: 'customer', name: 'Sara', email: 'sara@example.test', passHash: await auth.hashPassword('custpass123') });
    await auth.saveUser(c);
    expect(await resetLinkFor('sara@example.test')).toBe('');
    expect((await auth.getUser(c.id))!.invite).toBeNull();
  });

  it('does nothing for a switched-off account or someone who has not joined yet', async () => {
    await joined('cashier', 'off@example.test', { active: false });
    expect(await resetLinkFor('off@example.test')).toBe('');
    const pending = auth.newUser({ kind: 'staff', role: 'cashier', name: 'New Hire', email: 'hire@example.test' });
    await auth.saveUser(pending);
    expect(await resetLinkFor('hire@example.test')).toBe('');
  });

  it('leaves a trace in the activity log', async () => {
    const { readAudit } = await import('@/lib/server/audit');
    await joined('cashier', 'trace@example.test');
    await resetLinkFor('trace@example.test');
    expect((await readAudit(50)).some((e) => e.action === 'Asked for a password reset link' && e.kind === 'security')).toBe(true);
  });
});

describe('emailing a staff link', () => {
  it('reports that it was not sent when no email service is set up', async () => {
    const sent = await access.emailStaffLink({ name: 'Ayesha Khan', email: 'ayesha@example.test' }, 'tok123', 'invite', 'Owner');
    expect(sent).toBe(false);
  });

  it('builds the link from the real site in production, never from the address the request came to', () => {
    const was = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      expect(access.staffLink('abc', 'https://evil.example')).toBe(`${access.siteBase()}/staff/invite/abc`);
      expect(access.staffLink('abc', 'https://evil.example')).not.toContain('evil');
    } finally {
      (process.env as Record<string, string>).NODE_ENV = was!;
    }
    expect(access.staffLink('abc', 'http://localhost:3000')).toBe('http://localhost:3000/staff/invite/abc');
  });
});

describe('owner alerts', () => {
  it('matches only the security events an owner should hear about', () => {
    for (const a of ['Sign-in locked after too many tries', 'Reset two-step sign-in for Ali', 'Turned off two-step sign-in', 'Reset their password']) expect(alerts.ALERT_ACTIONS.test(a)).toBe(true);
    for (const a of ['Signed in', 'Turned on two-step sign-in', 'Blocked: tried something their role does not allow', 'Changed their password']) expect(alerts.ALERT_ACTIONS.test(a)).toBe(false);
  });

  it('emails nobody and frees the gate again when no email service is set up', async () => {
    await joined('owner', 'alerts-owner@example.test');
    expect(await alerts.alertOwners('Test', 'Something happened', 'gate-1')).toBe(0);
    // Not marked as sent, so the next occurrence may try again once email is set up.
    expect(await store.kv.get('alert:gate-1')).toBeNull();
  });

  it('never throws', async () => {
    expect(await alerts.alertOwners('Test', 'x', 'gate-2')).toBe(0);
  });
});
