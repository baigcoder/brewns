import { afterAll, beforeAll, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { monthOf, payTotals, shiftMonth } from '@/lib/payroll';
import { DEFAULT_ROLE_PERMS } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.SMTP_USER;
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;

let auth: typeof import('@/lib/server/auth');
let payroll: typeof import('@/lib/server/payroll');
const owner = { user: { id: 'u-owner', name: 'Hassan Baig', role: 'owner', shops: [] }, role: 'owner', perms: [], settings: {} } as never;
const manager = { user: { id: 'u-man', name: 'Manager', role: 'manager', shops: [] }, role: 'manager', perms: DEFAULT_ROLE_PERMS.manager, settings: {} } as never;
let riderId = '';

beforeAll(async () => {
  setSystemTime(new Date('2026-11-10T07:00:00Z'));
  auth = await import('@/lib/server/auth');
  payroll = await import('@/lib/server/payroll');
  const u = auth.newUser({ kind: 'staff', role: 'rider', name: 'Ahmed Raza', email: 'ahmed@example.com', passHash: 'x' });
  await auth.saveUser(u);
  riderId = u.id;
});
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const rejects = async (p: Promise<unknown>, status: number) => {
  let err: { status?: number } | null = null;
  await p.catch((e) => (err = e));
  expect((err as { status?: number } | null)?.status).toBe(status);
};

describe('pay rules', () => {
  it('adds bonuses and overtime, takes off deductions and advances, never below zero', () => {
    const items = [
      { id: 'a', kind: 'bonus', amount: 5000, note: '', at: 0, by: '' },
      { id: 'b', kind: 'overtime', amount: 2000, note: '', at: 0, by: '' },
      { id: 'c', kind: 'deduction', amount: 1500, note: 'late', at: 0, by: '' },
      { id: 'd', kind: 'advance', amount: 10000, note: 'advance', at: 0, by: '' },
    ] as const;
    expect(payTotals(45000, [...items])).toEqual({ base: 45000, add: 7000, less: 11500, net: 40500 });
    expect(payTotals(1000, [items[3]]).net).toBe(0);
  });
  it('months run on the Lahore calendar', () => {
    expect(monthOf(Date.parse('2026-10-31T20:00:00Z'))).toBe('2026-11'); // 1am on the 1st in Lahore
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('payroll', () => {
  it('only an owner changes pay', async () => {
    await rejects(payroll.payAct(manager, { action: 'plan', userId: riderId, salary: 40000 }), 403);
  });

  it('salary, a bonus, a deduction with a reason, then paid and frozen', async () => {
    await payroll.payAct(owner, { action: 'plan', userId: riderId, salary: 40000, payDay: 1 });
    await payroll.payAct(owner, { action: 'item', userId: riderId, month: '2026-11', kind: 'bonus', amount: 3000, note: 'Most deliveries' });
    await rejects(payroll.payAct(owner, { action: 'item', userId: riderId, month: '2026-11', kind: 'deduction', amount: 500 }), 400); // needs a reason
    await payroll.payAct(owner, { action: 'item', userId: riderId, month: '2026-11', kind: 'deduction', amount: 500, note: 'Late twice' });
    let [row] = await payroll.payrollFor('2026-11');
    expect(row.totals.net).toBe(42500);

    await payroll.payAct(owner, { action: 'paid', userId: riderId, month: '2026-11', method: 'Bank transfer', ref: 'TX1' });
    // a raise after paying doesn't change a paid month
    await payroll.payAct(owner, { action: 'plan', userId: riderId, salary: 50000 });
    [row] = await payroll.payrollFor('2026-11');
    expect(row.month.paid).toMatchObject({ net: 42500, base: 40000, method: 'Bank transfer' });
    expect(row.totals.net).toBe(42500);
    await rejects(payroll.payAct(owner, { action: 'item', userId: riderId, month: '2026-11', kind: 'bonus', amount: 1 }), 409);
  });

  it('the rider sees their own months, newest first', async () => {
    const me = (await auth.getUser(riderId))!;
    const mine = await payroll.myPay(me);
    expect(mine.plan?.salary).toBe(50000);
    expect(mine.months[0]).toMatchObject({ ym: '2026-11' });
    expect(mine.months[0].month.paid?.net).toBe(42500);
  });

  it('rejects nonsense', async () => {
    await rejects(payroll.payAct(owner, { action: 'plan', userId: riderId, salary: -5 }), 400);
    await rejects(payroll.payAct(owner, { action: 'plan', userId: riderId, salary: 1000, payDay: 31 }), 400);
    await rejects(payroll.payAct(owner, { action: 'item', userId: riderId, month: '2026-13', kind: 'bonus', amount: 1 }), 400);
    await rejects(payroll.payAct(owner, { action: 'paid', userId: riderId, month: '2026-12', method: 'Gold bars' }), 400);
    await rejects(payroll.payAct(owner, { action: 'plan', userId: 'nobody', salary: 1 }), 404);
  });
});
