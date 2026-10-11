import { afterAll, beforeAll, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogItem, defaultSel } from '@/lib/catalog';
import { DEFAULT_ROLE_PERMS } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-counter-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TWILIO_ACCOUNT_SID;

let orders: typeof import('@/lib/server/orders');
let store: typeof import('@/lib/server/store');
let settings: typeof import('@/lib/server/settings');

beforeAll(async () => {
  orders = await import('@/lib/server/orders');
  store = await import('@/lib/server/store');
  settings = await import('@/lib/server/settings');
});
beforeEach(() => setSystemTime(new Date('2026-03-04T07:00:00Z'))); // noon in Lahore
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const rejects = async (p: Promise<unknown>, status: number, text?: string) => {
  let err: { status?: number; message?: string } | null = null;
  await p.catch((e) => (err = e));
  expect((err as { status?: number } | null)?.status).toBe(status);
  if (text) expect((err as { message?: string } | null)?.message).toContain(text);
};

const cashier = { user: { id: 'u-ayesha', name: 'Ayesha', role: 'cashier', shops: [] }, role: 'cashier', perms: DEFAULT_ROLE_PERMS.cashier, settings: {} } as never;
const counter = { kind: 'staff', ctx: cashier, source: 'counter' } as const;
const table = { kind: 'staff', ctx: cashier, source: 'table' } as const;
const base = { loc: 0, area: null, address: '', when: 'asap', name: '', phone: '', email: '', note: '', pay: 0, promo: '', useReward: false } as const;
const americano = (qty = 1) => [{ id: 'americano', qty, sel: defaultSel(catalogItem('americano')!) }];
const ring = (payment: { method: number; tendered?: number; ref?: string } | undefined, qty = 2, by: typeof counter | typeof table = counter) =>
  orders.placeOrder({ ...base, mode: by.source === 'table' ? 'dinein' : 'pickup', table: by.source === 'table' ? 3 : null, items: americano(qty), payment }, by);

describe('the counter takes payment before the kitchen sees the order', () => {
  it('refuses a counter order with no payment', async () => {
    await rejects(ring(undefined), 400, 'Take payment first');
  });

  it('takes cash, works out the change, and sends the order to the stations', async () => {
    const probe = (await ring({ method: 0 })).order.totals.total; // exact cash, to learn the total
    const { order } = await ring({ method: 0, tendered: probe + 500 });
    expect(order.paid).toMatchObject({ method: 0, by: 'Ayesha', byId: 'u-ayesha', tendered: probe + 500, change: 500 });
    expect(order.status).toBe('accepted');
    expect(order.stations).toEqual({ bar: 'queued' });
    expect(order.source).toBe('counter');
    expect(order.events.some((e) => e.what === 'paid')).toBe(true);
  });

  it('refuses cash that does not cover the bill', async () => {
    await rejects(ring({ method: 0, tendered: 100 }), 400, 'short of the bill');
  });

  it('prices the tax by the way it is paid: 16% for cash, 5% for card or wallet', async () => {
    const cash = (await ring({ method: 0 })).order.totals;
    const card = (await ring({ method: 1, ref: 'APP4821' })).order.totals;
    const wallet = (await ring({ method: 2, ref: 'JC-77001122' })).order.totals;
    expect(cash.rate).toBe(0.16);
    expect(card.rate).toBe(0.05);
    expect(wallet.rate).toBe(0.05);
    expect(card.total).toBeLessThan(cash.total);
    expect(card.sub).toBe(cash.sub);
  });

  it('needs the approval code for a card and the transaction ID for a wallet', async () => {
    await rejects(ring({ method: 1 }), 400, 'approval code');
    await rejects(ring({ method: 1, ref: '1' }), 400, 'approval code');
    await rejects(ring({ method: 2 }), 400, 'transaction ID');
    await rejects(ring({ method: 7 }), 400, 'cash, card or wallet');
  });

  it('keeps the approval code on the order', async () => {
    const { order } = await ring({ method: 1, ref: 'ok99' });
    expect(order.paid).toMatchObject({ method: 1, ref: 'OK99' });
  });

  it('lets one wallet payment pay for one order only', async () => {
    await ring({ method: 2, ref: 'EP-5550001' });
    await rejects(ring({ method: 2, ref: 'ep-5550001' }), 409, 'already attached');
  });

  it('does not use up a transaction ID on an order that failed', async () => {
    await store.kv.set('settings', { ...(await settings.getSettings()), stock: { americano: 1 }, soldOut: [] });
    await rejects(ring({ method: 2, ref: 'EP-6660002' }, 5), 409); // not enough stock
    await store.kv.set('settings', { ...(await settings.getSettings()), stock: {}, soldOut: [] });
    const { order } = await ring({ method: 2, ref: 'EP-6660002' });
    expect(order.paid?.ref).toBe('EP-6660002');
  });

  it('refuses a promo code that does not exist, instead of quietly ignoring it', async () => {
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', table: null, items: americano(), promo: 'NOSUCHCODE', payment: { method: 0 } }, counter), 400, 'promo code');
  });
});

describe('tables and deliveries can be paid later', () => {
  it('sends a table order straight to the kitchen unpaid', async () => {
    const { order } = await ring(undefined, 1, table);
    expect(order.paid).toBeNull();
    expect(order.status).toBe('accepted');
  });

  it('is retaxed when the table pays by card instead of the cash it was priced for', async () => {
    const { order } = await ring(undefined, 4, table);
    expect(order.totals.rate).toBe(0.16);
    const paid = await orders.staffAct(order.number, { type: 'paid', method: 1, ref: 'CARD2468' }, cashier);
    expect(paid.totals.rate).toBe(0.05);
    expect(paid.totals.total).toBeLessThan(order.totals.total);
    expect(paid.totals.sub).toBe(order.totals.sub);
    expect(paid.pay).toBe(1);
    expect(paid.paid).toMatchObject({ method: 1, ref: 'CARD2468', byId: 'u-ayesha' });
  });

  it('keeps the tax when it is paid the way it was priced', async () => {
    const { order } = await ring(undefined, 2, table);
    const paid = await orders.staffAct(order.number, { type: 'paid', method: 0, tendered: order.totals.total + 200 }, cashier);
    expect(paid.totals).toEqual(order.totals);
    expect(paid.paid).toMatchObject({ method: 0, change: 200 });
  });

  it('refuses short cash and a malformed code when paying later too', async () => {
    const { order } = await ring(undefined, 2, table);
    await rejects(orders.staffAct(order.number, { type: 'paid', method: 0, tendered: 10 }, cashier), 400, 'short');
    await rejects(orders.staffAct(order.number, { type: 'paid', method: 1, ref: '!!' }, cashier), 400);
  });

  it('still takes a plain payment with no details, as a rider does at the door', async () => {
    const { order } = await ring(undefined, 2, table);
    const paid = await orders.staffAct(order.number, { type: 'paid', method: 0 }, cashier);
    expect(paid.paid?.method).toBe(0);
  });
});

describe('online orders are untouched', () => {
  it('ignores a payment smuggled into an order from the site', async () => {
    const guest = { kind: 'online', customer: null, guestReward: false } as const;
    const { order } = await orders.placeOrder({ ...base, name: 'Sara Khan', phone: '0300 1234567', mode: 'pickup', table: null, items: americano(), payment: { method: 1, ref: 'FAKE1234' } }, guest);
    expect(order.paid).toBeNull();
    expect(order.pay).toBe(0);
    expect(order.totals.rate).toBe(0.16);
  });
});
