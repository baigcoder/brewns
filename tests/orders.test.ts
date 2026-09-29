import { afterAll, beforeAll, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogItem, defaultSel } from '@/lib/catalog';

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
