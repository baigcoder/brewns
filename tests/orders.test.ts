import { afterAll, beforeAll, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogItem, defaultSel } from '@/lib/catalog';
import { DEFAULT_ROLE_PERMS } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TWILIO_ACCOUNT_SID;

let orders: typeof import('@/lib/server/orders');
let store: typeof import('@/lib/server/store');
let settings: typeof import('@/lib/server/settings');
let notify: typeof import('@/lib/server/orderNotify');

const guest = { kind: 'online', customer: null, guestReward: false } as const;
const base = { loc: 0, area: null, table: null, address: '', when: 'asap', name: 'Sara Khan', phone: '0300 1234567', email: '', note: '', pay: 0, promo: '', useReward: false } as const;
const americano = (qty = 1) => ({ id: 'americano', qty, sel: defaultSel(catalogItem('americano')!) });

beforeAll(async () => {
  orders = await import('@/lib/server/orders');
  store = await import('@/lib/server/store');
  settings = await import('@/lib/server/settings');
  notify = await import('@/lib/server/orderNotify');
});
beforeEach(() => setSystemTime(new Date('2026-03-04T07:00:00Z'))); // noon in Lahore, shops open
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const rejects = async (p: Promise<unknown>, status: number) => {
  let err: { status?: number } | null = null;
  await p.catch((e) => (err = e));
  expect((err as { status?: number } | null)?.status).toBe(status);
};

describe('placing an order', () => {
  it('prices from the catalog and starts the stations', async () => {
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano(2)] }, guest);
    expect(order.items[0].total).toBe(order.items[0].unit * 2);
    expect(order.totals.sub).toBe(order.items[0].total);
    expect(order.status).toBe('accepted'); // auto-accept is on by default
    expect(order.stations).toEqual({ bar: 'queued' });
    expect(order.key.length).toBeGreaterThan(10);
  });

  it('numbers orders in sequence', async () => {
    const a = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    const b = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    expect(b.order.number).toBe(a.order.number + 1);
  });

  it('rejects bad input', async () => {
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [] }, guest), 400);
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [{ id: 'nope', qty: 1, sel: {} }] }, guest), 400);
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [americano(31)] }, guest), 400);
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', name: '', items: [americano()] }, guest), 400);
    await rejects(orders.placeOrder({ ...base, mode: 'delivery', area: null, items: [americano()] }, guest), 400);
  });

  it('refuses sold-out items and closed hours', async () => {
    const s = await settings.getSettings();
    await store.kv.set('settings', { ...s, soldOut: ['americano'] });
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest), 409);
    await store.kv.set('settings', { ...s, soldOut: [] });
    setSystemTime(new Date('2026-03-04T21:30:00Z')); // 02:30 in Lahore
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest), 409);
  });
});

describe('the customer tracking key', () => {
  it('lets only the holder cancel', async () => {
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    await rejects(orders.customerAct(order.number, 'wrong-key', { type: 'cancel' }), 404);
    await rejects(orders.customerAct(order.number, '', { type: 'cancel' }), 404);
    const done = await orders.customerAct(order.number, order.key, { type: 'cancel' });
    expect(done.status).toBe('cancelled');
  });

  it('cannot cancel once the bar has started', async () => {
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    order.stations.bar = 'making';
    await orders.saveOrder(order);
    await rejects(orders.customerAct(order.number, order.key, { type: 'cancel' }), 409);
  });

  it('never exposes the key in the public view', async () => {
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    expect(JSON.stringify(orders.publicOrder(order))).not.toContain(order.key);
  });
});

describe('order notifications', () => {
  it('words each milestone and stays silent otherwise', () => {
    const o = { number: 1234, mode: 'pickup' as const, status: 'ready' as const, name: 'Sara Khan', loc: 0, target: Date.UTC(2026, 2, 4, 7, 15), rider: null, table: null };
    expect(notify.orderMessage(o)?.text).toContain('#01234');
    expect(notify.orderMessage(o)?.text).toContain('ready');
    expect(notify.orderMessage(o, 'preparing')).toBeNull();
    expect(notify.orderMessage({ ...o, mode: 'dinein', table: 4 })).toBeNull();
    expect(notify.orderMessage({ ...o, status: 'cancelled', cancelReason: 'Out of milk' })?.text).toContain('Out of milk');
  });

  it('records one message per milestone', async () => {
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    const before = (await store.kv.list('order_notifications')).length;
    await notify.notifyOrder(order, undefined, 'received'); // placeOrder already sent this one
    expect((await store.kv.list('order_notifications')).length).toBe(before);
    await orders.customerAct(order.number, order.key, { type: 'cancel' });
    expect((await store.kv.list('order_notifications')).length).toBe(before + 1);
  });
});

describe('stock counts', () => {
  it('counts down, sells out at zero and refuses more than is left', async () => {
    await settings.setStock('americano', 3);
    await orders.placeOrder({ ...base, mode: 'pickup', items: [americano(2)] }, guest);
    expect((await settings.getSettings()).stock.americano).toBe(1);
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [americano(2)] }, guest), 409);
    expect((await settings.getSettings()).stock.americano).toBe(1); // a refused order takes nothing
    await orders.placeOrder({ ...base, mode: 'pickup', items: [americano(1)] }, guest);
    const s = await settings.getSettings();
    expect(s.stock.americano).toBe(0);
    expect(s.soldOut).toContain('americano');
    await rejects(orders.placeOrder({ ...base, mode: 'pickup', items: [americano(1)] }, guest), 409);
  });

  it('puts stock back when an order is cancelled', async () => {
    await settings.setStock('americano', 2);
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano(2)] }, guest);
    expect((await settings.getSettings()).soldOut).toContain('americano');
    await orders.customerAct(order.number, order.key, { type: 'cancel' });
    const s = await settings.getSettings();
    expect(s.stock.americano).toBe(2);
    expect(s.soldOut).not.toContain('americano');
  });

  it('leaves uncounted items unlimited and lets staff stop counting', async () => {
    await settings.setStock('americano', null);
    expect((await settings.getSettings()).stock.americano).toBeUndefined();
    await orders.placeOrder({ ...base, mode: 'pickup', items: [americano(30)] }, guest);
  });
});

describe('links and verified reviews', () => {
  const call = (handler: (req: Request, ctx: { params: Promise<{ number: string }> }) => Promise<Response>, number: number, key: string, body?: unknown) =>
    handler(
      new Request(`http://localhost/api/orders/${number}/review?k=${encodeURIComponent(key)}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
      { params: Promise.resolve({ number: String(number) }) },
    );

  it('puts the tracking and review links in the right messages', () => {
    const o = { number: 42, key: 'sekret', mode: 'pickup' as const, status: 'ready' as const, name: 'Sara Khan', loc: 0, target: Date.UTC(2026, 2, 4, 7, 15), rider: null, table: null };
    expect(notify.orderMessage(o)?.text).toContain('/?track=42&k=sekret');
    expect(notify.orderMessage(o)?.text).not.toContain('/review/');
    expect(notify.orderMessage({ ...o, status: 'collected' })?.text).toContain('/review/42?k=sekret');
    expect(notify.orderMessage({ ...o, mode: 'delivery', status: 'delivered' })?.text).toContain('/review/42?k=sekret');
  });

  it('takes one verified review per received order, for the key holder only', async () => {
    const route = await import('@/app/api/orders/[number]/review/route');
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    expect((await call(route.POST, order.number, order.key, { stars: 5, quote: 'Great' })).status).toBe(409); // not collected yet
    order.status = 'collected';
    await orders.saveOrder(order);
    expect((await call(route.POST, order.number, 'wrong', { stars: 5, quote: 'Great coffee' })).status).toBe(404);
    expect((await call(route.POST, order.number, order.key, { stars: 9, quote: 'Great coffee' })).status).toBe(400);
    expect((await call(route.GET, order.number, order.key)).status).toBe(200);
    const ok = await call(route.POST, order.number, order.key, { stars: 5, quote: 'Great coffee' });
    expect(ok.status).toBe(201);
    expect(((await ok.json()) as { review: { verified: boolean } }).review.verified).toBe(true);
    expect((await call(route.POST, order.number, order.key, { stars: 4, quote: 'Again' })).status).toBe(409);
    const info = (await (await call(route.GET, order.number, order.key)).json()) as { reason: string };
    expect(info.reason).toBe('already');
  });
});

describe('pay-first delivery', () => {
  const delivery = { ...base, mode: 'delivery' as const, area: 0, address: 'House 12, Street 4, Block B' };
  const staff = (role: 'cashier' | 'barista') =>
    ({ user: { id: `u-${role}`, name: role, role, shops: [] }, role, perms: DEFAULT_ROLE_PERMS[role], settings: {} }) as never;
  const turnOn = async (minTotal: number | null = 500) => {
    const s = await settings.getSettings();
    await store.kv.set('settings', { ...s, prepay: { minTotal, holdMin: 10, payTo: 'Raast ID: test@bank' }, soldOut: [], stock: {} });
  };
  const place = (pay: number, qty = 4) => orders.placeOrder({ ...delivery, pay, items: [americano(qty)] }, guest);

  it('is off by default and only asks big delivery orders to pay first', async () => {
    await turnOn(null);
    expect((await place(0)).order.hold).toBeUndefined();
    await turnOn(50000);
    expect((await place(0)).order.hold).toBeUndefined(); // under the minimum
    await turnOn(500);
    await rejects(place(0), 400); // must choose the wallet
    const pickup = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano(4)] }, guest);
    expect(pickup.order.hold).toBeUndefined(); // pickup is never held
  });

  it('holds the order away from the kitchen until the cashier confirms payment', async () => {
    await turnOn();
    const { order } = await place(2);
    expect(order.status).toBe('received');
    expect(order.hold?.until).toBeGreaterThan(Date.now());
    expect(orders.visibleTo(order, staff('barista'))).toBe(false);
    expect(orders.visibleTo(order, staff('cashier'))).toBe(true);
    await rejects(orders.staffAct(order.number, { type: 'accept' }, staff('cashier')), 409);
    await rejects(orders.staffAct(order.number, { type: 'confirmpay' }, staff('barista')), 403);
    const done = await orders.staffAct(order.number, { type: 'confirmpay' }, staff('cashier'));
    expect(done.hold).toBeUndefined();
    expect(done.status).toBe('accepted');
    expect(done.paid?.method).toBe(2);
    expect(orders.visibleTo(done, staff('barista'))).toBe(true);
  });

  it('takes a transaction ID from the key holder only, and only while held', async () => {
    await turnOn();
    const { order } = await place(2);
    await rejects(orders.customerAct(order.number, 'wrong', { type: 'payref', text: '3847291056' }), 404);
    await rejects(orders.customerAct(order.number, order.key, { type: 'payref', text: 'x y' }), 400);
    const held = await orders.customerAct(order.number, order.key, { type: 'payref', text: '3847291056' });
    expect(held.hold?.ref).toBe('3847291056');
    expect(orders.publicOrder(held).hold?.ref).toBe('3847291056');
    await orders.staffAct(order.number, { type: 'confirmpay' }, staff('cashier'));
    await rejects(orders.customerAct(order.number, order.key, { type: 'payref', text: '3847291056' }), 409);
  });

  it('cancels unpaid orders when the time runs out and gives the stock back', async () => {
    await turnOn();
    await settings.setStock('americano', 10);
    const { order } = await place(2, 4);
    expect((await settings.getSettings()).stock.americano).toBe(6);
    expect(await orders.expireHolds()).toBe(0); // still inside the window
    setSystemTime(new Date('2026-03-04T07:11:00Z'));
    expect(await orders.expireHolds()).toBe(1);
    const gone = await orders.getOrder(order.number);
    expect(gone?.status).toBe('cancelled');
    expect(gone?.cancelReason).toMatch(/payment/i);
    expect((await settings.getSettings()).stock.americano).toBe(10);
    await rejects(orders.staffAct(order.number, { type: 'confirmpay' }, staff('cashier')), 409);
    expect(await orders.expireHolds()).toBe(0);
  });

  it('tells the customer where to pay', () => {
    const o = { number: 7, key: 'k1', mode: 'delivery' as const, status: 'received' as const, name: 'Sara', loc: 0, target: Date.now() + 3600000, rider: null, table: null, hold: { until: Date.now() + 600000, ref: '' } };
    const text = notify.orderMessage(o)?.text || '';
    expect(text).toContain('/pay/7?k=k1');
    expect(text).not.toContain('Track it');
  });
});

describe('refunds', () => {
  const delivery = { ...base, mode: 'delivery' as const, area: 0, address: 'House 12, Street 4, Block B' };
  const staff = (role: 'cashier' | 'barista') =>
    ({ user: { id: `u-${role}`, name: role, role, shops: [] }, role, perms: DEFAULT_ROLE_PERMS[role], settings: {} }) as never;
  const paidOrder = async (qty = 4) => {
    const s = await settings.getSettings();
    await store.kv.set('settings', { ...s, prepay: { minTotal: 500, holdMin: 10, payTo: 'Raast ID: test@bank' }, soldOut: [], stock: {} });
    const { order } = await orders.placeOrder({ ...delivery, pay: 2, items: [americano(qty)] }, guest);
    await orders.customerAct(order.number, order.key, { type: 'payref', text: 'TXN123456' });
    return orders.staffAct(order.number, { type: 'confirmpay' }, staff('cashier'));
  };

  it('opens a full refund when a paid order is cancelled, and keeps the customer’s transaction ID', async () => {
    const paid = await paidOrder();
    expect(paid.payRef).toBe('TXN123456');
    const done = await orders.staffAct(paid.number, { type: 'cancel', reason: 'Out of milk' }, staff('cashier'));
    expect(done.status).toBe('cancelled');
    expect(done.refund).toMatchObject({ amount: paid.totals.total, state: 'pending', method: 2 });
    const list = await orders.refundList(staff('cashier'));
    expect(list.pending.find((r) => r.number === paid.number)).toMatchObject({ payRef: 'TXN123456', amount: paid.totals.total });
    expect(list.owed).toBeGreaterThanOrEqual(paid.totals.total);
  });

  it('lets the cashier refund less, or nothing, when cancelling', async () => {
    const a = await paidOrder();
    const part = await orders.staffAct(a.number, { type: 'cancel', reason: 'Rider fell ill', refundAmount: 1000 }, staff('cashier'));
    expect(part.refund?.amount).toBe(1000);
    const b = await paidOrder();
    const none = await orders.staffAct(b.number, { type: 'cancel', reason: 'Prank', refundAmount: 0 }, staff('cashier'));
    expect(none.refund).toBeUndefined();
    const c = await paidOrder();
    await rejects(orders.staffAct(c.number, { type: 'cancel', reason: 'x', refundAmount: c.totals.total + 1 }, staff('cashier')), 400);
  });

  it('never refunds an order nobody paid for', async () => {
    const s = await settings.getSettings();
    await store.kv.set('settings', { ...s, prepay: { minTotal: null, holdMin: 10, payTo: 'x' } });
    const { order } = await orders.placeOrder({ ...base, mode: 'pickup', items: [americano()] }, guest);
    const done = await orders.staffAct(order.number, { type: 'cancel', reason: 'Changed mind' }, staff('cashier'));
    expect(done.refund).toBeUndefined();
    await rejects(orders.staffAct(order.number, { type: 'refund', amount: 100, reason: 'nothing paid' }, staff('cashier')), 409);
  });

  it('records a part refund on a kept order, once, for the cashier only', async () => {
    const paid = await paidOrder();
    await rejects(orders.staffAct(paid.number, { type: 'refund', amount: 200, reason: 'One item missing' }, staff('barista')), 403);
    await rejects(orders.staffAct(paid.number, { type: 'refund', amount: 0, reason: 'One item missing' }, staff('cashier')), 400);
    await rejects(orders.staffAct(paid.number, { type: 'refund', amount: 200, reason: '' }, staff('cashier')), 400);
    const r = await orders.staffAct(paid.number, { type: 'refund', amount: 200, reason: 'One item missing' }, staff('cashier'));
    expect(r.refund).toMatchObject({ amount: 200, state: 'pending' });
    expect(r.status).toBe('accepted'); // the order carries on
    await rejects(orders.staffAct(paid.number, { type: 'refund', amount: 100, reason: 'Again' }, staff('cashier')), 409);
  });

  it('marks a refund sent with its transaction ID, once', async () => {
    const paid = await paidOrder();
    await orders.staffAct(paid.number, { type: 'cancel', reason: 'Out of milk' }, staff('cashier'));
    await rejects(orders.staffAct(paid.number, { type: 'refundpaid', ref: '' }, staff('cashier')), 400); // wallet refunds need a reference
    await rejects(orders.staffAct(paid.number, { type: 'refundpaid', ref: 'RF998877' }, staff('barista')), 403);
    const done = await orders.staffAct(paid.number, { type: 'refundpaid', ref: 'RF998877' }, staff('cashier'));
    expect(done.refund).toMatchObject({ state: 'paid', ref: 'RF998877', paidBy: 'cashier' });
    await rejects(orders.staffAct(paid.number, { type: 'refundpaid', ref: 'RF998877' }, staff('cashier')), 409);
    const list = await orders.refundList(staff('cashier'));
    expect(list.pending.find((r) => r.number === paid.number)).toBeUndefined();
    expect(list.paid.find((r) => r.number === paid.number)?.ref).toBe('RF998877');
  });

  it('refunds a paid order the customer cancels themselves', async () => {
    const s = await settings.getSettings();
    await store.kv.set('settings', { ...s, prepay: { minTotal: 500, holdMin: 10, payTo: 'x' } });
    const { order } = await orders.placeOrder({ ...delivery, pay: 2, items: [americano(4)] }, guest);
    await orders.staffAct(order.number, { type: 'confirmpay' }, staff('cashier'));
    const done = await orders.customerAct(order.number, order.key, { type: 'cancel' });
    expect(done.refund).toMatchObject({ amount: order.totals.total, state: 'pending' });
  });

  it('words the refund messages', () => {
    const o = { number: 9, paid: { t: 1, by: 'x', method: 2 }, refund: { amount: 3360, state: 'pending' as const, reason: 'Out of milk.', at: 1, by: 'x', method: 2 } };
    expect(notify.refundMessage(o, 'due')?.text).toContain('Rs 3,360');
    expect(notify.refundMessage(o, 'due')?.text).toContain('Out of milk');
    expect(notify.refundMessage({ ...o, refund: { ...o.refund, ref: 'RF1234', state: 'paid' as const } }, 'paid')?.text).toContain('RF1234');
    expect(notify.refundMessage({ number: 9 } as never, 'due')).toBeNull();
    expect(notify.orderMessage({ number: 9, mode: 'delivery', status: 'cancelled', name: 'Sara', loc: 0, target: 0, rider: null, table: null, refund: o.refund })?.text).toContain('refund of Rs 3,360');
  });
});
