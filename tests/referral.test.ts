import { afterAll, beforeAll, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogItem, defaultSel } from '@/lib/catalog';
import { priceOrder } from '@/lib/pricing';
import { inviteCode, REFERRAL, refProblem } from '@/lib/referral';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-ref-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TWILIO_ACCOUNT_SID;

let orders: typeof import('@/lib/server/orders');
let auth: typeof import('@/lib/server/auth');
let refs: typeof import('@/lib/server/referrals');

const base = { loc: 0, area: null, table: null, address: '', when: 'asap', email: '', note: '', pay: 0, useReward: false } as const;
const latte = (qty: number) => ({ id: 'latte', qty, sel: defaultSel(catalogItem('latte')!) });
const guest = { kind: 'online', customer: null, guestReward: false } as const;

beforeAll(async () => {
  orders = await import('@/lib/server/orders');
  auth = await import('@/lib/server/auth');
  refs = await import('@/lib/server/referrals');
});
beforeEach(() => setSystemTime(new Date('2026-03-04T07:00:00Z'))); // noon in Lahore, shops open
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const status = async (p: Promise<unknown>) => {
  let err: { status?: number } | null = null;
  await p.catch((e) => (err = e));
  return (err as { status?: number } | null)?.status;
};

const customer = (name: string, phone: string) =>
  auth.saveUser(auth.newUser({ kind: 'customer', role: 'customer', name, email: `${name.toLowerCase()}@example.com`, phone, passHash: 'x' }));

describe('the rules', () => {
  it('makes a readable code from the name', () => {
    expect(inviteCode('Hassan Baig', 482)).toBe('HASSAN482');
    expect(inviteCode('عائشہ', 7)).toBe('BREWNS007');
  });

  it('takes rupees off without going below zero', () => {
    const lines = [{ cat: 'drinks', qty: 1, unit: 200 }];
    expect(priceOrder(lines, { mode: 'pickup', area: null, pay: 0, promoPct: 0, promoOff: 300, useReward: false }).promo).toBe(200);
  });

  it('refuses your own code, a second discount on one mobile, and a small order', () => {
    const invite = { kind: 'invite', owner: 'u1', ownerPhone: '03001112222' } as const;
    expect(refProblem(invite, { customerId: 'u1', phone: '' })).toMatch(/own code/);
    expect(refProblem(invite, { customerId: null, phone: '03001112222' })).toMatch(/own code/);
    expect(refProblem(invite, { customerId: null, phone: '03009998888', usedBefore: true })).toMatch(/already had/);
    expect(refProblem(invite, { customerId: null, phone: '03009998888', subtotal: REFERRAL.minOrder - 1 })).toMatch(/needs an order/);
    expect(refProblem(invite, { customerId: null, phone: '03009998888', subtotal: REFERRAL.minOrder })).toBe('');
  });
});

describe('a referral, end to end', () => {
  it('gives the friend Rs 300, then the inviter a code of their own they can spend once', async () => {
    const hassan = await customer('Hassan', '0300 1112222');
    const { code } = await refs.referralOf(hassan);
    expect(await refs.referralOf(hassan)).toMatchObject({ code }); // the same code every time

    // Too small an order, and your own code, are refused.
    expect(await status(orders.placeOrder({ ...base, mode: 'pickup', name: 'Sara', phone: '0300 3334444', promo: code, items: [latte(1)] }, guest))).toBe(400);
    expect(await status(orders.placeOrder({ ...base, mode: 'pickup', name: 'Hassan', phone: '0300 1112222', promo: code, items: [latte(2)] }, { kind: 'online', customer: hassan, guestReward: false }))).toBe(400);

    // The friend's first order.
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', name: 'Sara', phone: '0300 3334444', promo: code, items: [latte(2)] }, guest);
    expect(order.totals.promo).toBe(REFERRAL.give);
    expect(order.referral).toEqual({ code, owner: hassan.id });
    // Once per mobile, however it is typed.
    expect(await status(orders.placeOrder({ ...base, mode: 'pickup', name: 'Sara', phone: '+92 300 3334444', promo: code, items: [latte(2)] }, guest))).toBe(400);

    // Nothing for Hassan until it is collected; saving it twice pays once.
    expect(await refs.openThanks(hassan.id)).toEqual([]);
    await orders.saveOrder({ ...(await orders.getOrder(order.number))!, status: 'collected' });
    await orders.saveOrder({ ...(await orders.getOrder(order.number))!, status: 'collected' });
    const credits = await refs.openThanks(hassan.id);
    expect(credits).toHaveLength(1);
    expect(await refs.referralOf(hassan)).toMatchObject({ invited: 1, earned: REFERRAL.get });

    // Only Hassan can spend it, once.
    const thanks = credits[0].code;
    expect(await status(orders.placeOrder({ ...base, mode: 'pickup', name: 'Sara', phone: '0300 3334444', promo: thanks, items: [latte(1)] }, guest))).toBe(400);
    const spent = await orders.placeOrder({ ...base, mode: 'pickup', name: 'Hassan', phone: '0300 1112222', promo: thanks, items: [latte(1)] }, { kind: 'online', customer: hassan, guestReward: false });
    expect(spent.order.totals.promo).toBe(Math.min(REFERRAL.get, spent.order.totals.sub));
    expect(await refs.openThanks(hassan.id)).toEqual([]);
    expect(await status(orders.placeOrder({ ...base, mode: 'pickup', name: 'Hassan', phone: '0300 1112222', promo: thanks, items: [latte(1)] }, { kind: 'online', customer: hassan, guestReward: false }))).toBe(400);
  });

  it('is gone with the account', async () => {
    const amna = await customer('Amna', '0300 5556666');
    const { code } = await refs.referralOf(amna);
    await refs.deleteReferral(amna.id);
    expect(await refs.findRefCode(code)).toBeNull();
  });
});
