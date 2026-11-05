import { afterAll, beforeAll, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogItem, defaultSel } from '@/lib/catalog';
import { orderAlerts, snapshot, type AlertOrder } from '@/lib/orderAlerts';
import { DEFAULT_ROLE_PERMS, type Role } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TWILIO_ACCOUNT_SID;

let orders: typeof import('@/lib/server/orders');
let store: typeof import('@/lib/server/store');
let settings: typeof import('@/lib/server/settings');
let reports: typeof import('@/lib/server/reports');

const guest = { kind: 'online', customer: null, guestReward: false } as const;
const delivery = { loc: 0, area: 0, table: null, address: 'House 12, Street 4, Block B', when: 'asap', name: 'Sara Khan', phone: '0300 1234567', email: '', note: '', pay: 0, promo: '', useReward: false, mode: 'delivery' } as const;
const line = (id: string, qty = 1) => ({ id, qty, sel: defaultSel(catalogItem(id)!) });
const staff = (role: Role, id = `u-${role}`) => ({ user: { id, name: `${role} one`, role, shops: [], plate: 'LEA 1' }, role, perms: DEFAULT_ROLE_PERMS[role], settings: {} }) as never;

beforeAll(async () => {
  orders = await import('@/lib/server/orders');
  store = await import('@/lib/server/store');
  settings = await import('@/lib/server/settings');
  reports = await import('@/lib/server/reports');
  await store.kv.hset('users', 'u-rider', { id: 'u-rider', kind: 'staff', role: 'rider', name: 'rider one', plate: 'LEA 1', active: true, shops: [], lastSeenAt: 0 });
});
beforeEach(() => setSystemTime(new Date('2026-03-04T07:00:00Z'))); // noon in Lahore
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const rejects = async (p: Promise<unknown>, status: number) => {
  let err: { status?: number } | null = null;
  await p.catch((e) => (err = e));
  expect((err as { status?: number } | null)?.status).toBe(status);
};
const autoAccept = async (on: boolean) => {
  const s = await settings.getSettings();
  await store.kv.set('settings', { ...s, shops: s.shops.map((x) => ({ ...x, autoAccept: on })) });
};
const later = (min: number) => setSystemTime(new Date(Date.now() + min * 60000));

describe('a delivery, through every role', () => {
  it('goes counter → stations → dispatcher → rider → customer, with a time for every step', async () => {
    await autoAccept(false);
    const { order } = await orders.placeOrder({ ...delivery, items: [line('americano', 2), line('smash-burger')] }, guest);
    expect(order.status).toBe('received');
    expect(order.stations).toEqual({ bar: 'queued', kitchen: 'queued' });
    const n = order.number;

    // The kitchen can't start what the counter hasn't accepted.
    await rejects(orders.staffAct(n, { type: 'station', station: 'bar', state: 'making' }, staff('barista')), 409);
    later(1);
    expect((await orders.staffAct(n, { type: 'accept' }, staff('cashier'))).status).toBe('accepted');

    // Each station works its own part only.
    await rejects(orders.staffAct(n, { type: 'station', station: 'kitchen', state: 'making' }, staff('barista')), 403);
    later(1);
    expect((await orders.staffAct(n, { type: 'station', station: 'bar', state: 'making' }, staff('barista'))).status).toBe('preparing');
    await orders.staffAct(n, { type: 'station', station: 'kitchen', state: 'making' }, staff('chef'));
    later(4);
    expect((await orders.staffAct(n, { type: 'station', station: 'bar', state: 'done' }, staff('barista'))).status).toBe('preparing');
    later(3);
    const ready = await orders.staffAct(n, { type: 'station', station: 'kitchen', state: 'done' }, staff('chef'));
    expect(ready.status).toBe('ready');
    expect(ready.items.every((i) => i.done)).toBe(true);

    // The pass: the dispatcher gives it to a rider, who leaves only once it's ready.
    await rejects(orders.staffAct(n, { type: 'pickup' }, staff('rider')), 403);
    later(1);
    expect((await orders.staffAct(n, { type: 'assign', riderId: 'u-rider' }, staff('cashier'))).rider?.name).toBe('rider one');
    later(1);
    expect((await orders.staffAct(n, { type: 'pickup' }, staff('rider'))).status).toBe('onway');
    later(10);
    await orders.staffAct(n, { type: 'arriving' }, staff('rider'));
    later(2);
    const done = await orders.staffAct(n, { type: 'delivered', code: order.handover }, staff('rider'));
    expect(done.status).toBe('delivered');
    expect(done.paid).not.toBeNull();

    const steps = done.events.map((e) => e.what);
    expect(steps).toEqual(['placed', 'accepted', 'bar:making', 'preparing', 'kitchen:making', 'bar:done', 'kitchen:done', 'ready', 'rider', 'onway', 'arriving', 'delivered']);
    expect(done.events.every((e, i) => i === 0 || e.t >= done.events[i - 1].t)).toBe(true);
    expect(done.events.find((e) => e.what === 'rider')?.by).toBe('cashier one');
    const times = orders.publicOrder(done).times;
    for (const stage of ['received', 'accepted', 'preparing', 'rider', 'onway', 'arriving', 'delivered']) expect(times[stage]).toBeGreaterThan(0);
    await autoAccept(true);
  });

  it('lets someone who runs orders start a station and accept in one go', async () => {
    await autoAccept(false);
    const { order } = await orders.placeOrder({ ...delivery, items: [line('americano', 3)] }, guest);
    expect((await orders.staffAct(order.number, { type: 'station', station: 'bar', state: 'making' }, staff('manager'))).status).toBe('preparing');
    await autoAccept(true);
  });
});

describe('who hears about what', () => {
  const o = (x: Partial<AlertOrder> = {}): AlertOrder => ({ number: 1001, status: 'accepted', mode: 'delivery', table: null, name: 'Sara', target: Date.now() + 20 * 60000, stations: { bar: 'queued' }, messages: [], rider: null, ...x });
  const look = (role: Role, before: AlertOrder[], after: AlertOrder[], now = Date.now(), calls: { before?: string[]; after?: string[] } = {}) => {
    const p = DEFAULT_ROLE_PERMS[role];
    const c = (ids: string[] = []) => ids.map((id) => ({ id, table: 3, kind: 'bill' as const }));
    return orderAlerts(snapshot(before, c(calls.before), p, now), snapshot(after, c(calls.after), p, now), after, c(calls.after), p).map((a) => a.kind);
  };

  it('says nothing on the first look', () => {
    const p = DEFAULT_ROLE_PERMS.cashier;
    expect(orderAlerts(null, snapshot([o({ status: 'received' })], [], p, Date.now()), [o({ status: 'received' })], [], p)).toEqual([]);
  });

  it('a new order goes to the counter to accept, not to the kitchen', () => {
    expect(look('cashier', [], [o({ status: 'received' })])).toEqual(['accept']);
    expect(look('barista', [], [o({ status: 'received' })])).toEqual([]);
  });

  it('a station hears about its own tickets once accepted, and when one is cancelled half made', () => {
    expect(look('barista', [o({ status: 'received' })], [o()])).toEqual(['ticket']);
    expect(look('chef', [o({ status: 'received' })], [o()])).toEqual([]);
    expect(look('barista', [o({ status: 'preparing', stations: { bar: 'making' } })], [])).toEqual(['stop']);
    expect(look('barista', [o({ status: 'preparing', stations: { bar: 'done' } })], [])).toEqual([]);
  });

  it('a ready delivery with no rider goes to the dispatcher and to free riders', () => {
    const before = [o({ status: 'preparing' })];
    const after = [o({ status: 'ready', stations: { bar: 'done' } })];
    expect(look('cashier', before, after)).toEqual(['needs-rider']);
    expect(look('rider', before, after)).toEqual(['needs-rider']);
    expect(look('cashier', before, [o({ status: 'ready', rider: { id: 'u-rider' } })])).toEqual([]);
  });

  it('a waiter hears food ready for a table and a table calling', () => {
    expect(look('waiter', [o({ mode: 'dinein', table: 4, status: 'preparing' })], [o({ mode: 'dinein', table: 4, status: 'ready' })])).toEqual(['serve']);
    expect(look('waiter', [], [], Date.now(), { after: ['0-3-bill'] })).toEqual(['call']);
  });

  it('the counter hears when an order runs late and when a customer writes', () => {
    const late = Date.now() + 35 * 60000;
    expect(look('cashier', [o()], [o()], late)).toEqual([]); // both looks are already late: told once, earlier
    const p = DEFAULT_ROLE_PERMS.cashier;
    const a = snapshot([o()], [], p, Date.now());
    const b = snapshot([o()], [], p, late);
    expect(orderAlerts(a, b, [o()], [], p).map((x) => x.kind)).toEqual(['late']);
    const msg = { id: 'm', from: 'you' as const, text: 'Ring the bell twice', t: Date.now() };
    expect(look('cashier', [o()], [o({ messages: [msg] })])).toEqual(['message']);
    expect(look('rider', [o()], [o({ messages: [msg] })])).toEqual([]);
  });
});

describe("the owner's daily count", () => {
  it('counts sold, each way of handing over, cancelled, refunds and what is still open, by shop', async () => {
    setSystemTime(new Date('2026-03-05T07:00:00Z')); // a fresh day
    const owner = { ...(staff('owner') as object), user: { id: 'u-owner', name: 'owner', role: 'owner', shops: [] } } as never;
    const pickup = { ...delivery, mode: 'pickup' as const, area: null, address: '' };
    const a = (await orders.placeOrder({ ...pickup, items: [line('americano')] }, guest)).order;
    await orders.staffAct(a.number, { type: 'ready' }, staff('manager'));
    await orders.staffAct(a.number, { type: 'collected' }, staff('cashier'));
    const b = (await orders.placeOrder({ ...pickup, items: [line('americano', 2)] }, guest)).order;
    await orders.staffAct(b.number, { type: 'paid', method: 0 }, staff('cashier'));
    await orders.staffAct(b.number, { type: 'cancel', reason: 'Customer left' }, staff('manager'));
    const c = (await orders.placeOrder({ ...pickup, items: [line('americano')] }, guest)).order; // still being made
    const d = (await orders.placeOrder({ ...delivery, items: [line('americano', 3)] }, guest)).order;
    await orders.staffAct(d.number, { type: 'ready' }, staff('manager'));
    await orders.staffAct(d.number, { type: 'take' }, staff('rider'));
    await orders.staffAct(d.number, { type: 'pickup' }, staff('rider'));
    await orders.staffAct(d.number, { type: 'delivered', code: d.handover }, staff('rider'));

    const r = await reports.report('today', owner);
    const k = r.kpis;
    expect(k.orders).toBe(3);
    expect(k.gross).toBe(a.totals.total + c.totals.total + d.totals.total);
    expect([k.delivered, k.collected, k.served]).toEqual([1, 1, 0]);
    expect([k.cancelled, k.cancelledValue]).toEqual([1, b.totals.total]);
    expect([k.refunds, k.refunded]).toEqual([1, b.totals.total]);
    expect([k.open, k.openValue]).toEqual([1, c.totals.total]);
    // Split by shop, the shops add up to the day.
    const sum = (f: (s: (typeof r.byShop)[number]) => number) => r.byShop.reduce((t, s) => t + f(s), 0);
    expect([sum((s) => s.orders), sum((s) => s.open), sum((s) => s.cancelled), sum((s) => s.delivered)]).toEqual([3, 1, 1, 1]);
    expect(r.byShop.find((s) => s.loc === d.loc)!.delivered).toBe(1);
  });
});
