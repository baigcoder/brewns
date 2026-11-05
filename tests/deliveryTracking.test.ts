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
let notify: typeof import('@/lib/server/orderNotify');

const guest = { kind: 'online', customer: null, guestReward: false } as const;
const delivery = { loc: 0, area: 0, table: null, address: 'House 12, Street 4, Block B', when: 'asap', name: 'Sara Khan', phone: '0300 1234567', email: '', note: '', pay: 0, promo: '', useReward: false, mode: 'delivery' } as const;
const items = [{ id: 'americano', qty: 2, sel: defaultSel(catalogItem('americano')!) }];
const staff = (role: 'rider' | 'manager' | 'barista', id = `u-${role}`) => ({ user: { id, name: `${role} ${id}`, role, shops: [], plate: 'LEA 1' }, role, perms: DEFAULT_ROLE_PERMS[role], settings: {} }) as never;
const rider = staff('rider');

beforeAll(async () => {
  orders = await import('@/lib/server/orders');
  notify = await import('@/lib/server/orderNotify');
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

/** A delivery taken by the rider and out on the road. */
const onTheRoad = async (extra: Record<string, unknown> = {}) => {
  const { order } = await orders.placeOrder({ ...delivery, items, ...extra }, guest);
  await orders.staffAct(order.number, { type: 'take' }, rider);
  await orders.staffAct(order.number, { type: 'ready' }, staff('manager'));
  await orders.staffAct(order.number, { type: 'pickup' }, rider);
  return order;
};

describe('the exact door', () => {
  it('is taken at checkout when it is in Lahore, and never shown to the kitchen', async () => {
    const { order } = await orders.placeOrder({ ...delivery, items, pin: { lat: 31.52421, lng: 74.34706 } }, guest);
    expect(order.pin).toEqual({ lat: 31.52421, lng: 74.34706 });
    expect(orders.publicOrder(order).pin).toEqual(order.pin!);
    expect((orders.staffView(order, staff('barista')) as { pin?: unknown }).pin).toBeUndefined();
    await rejects(orders.placeOrder({ ...delivery, items, pin: { lat: 24.86, lng: 67.0 } }, guest), 400);
  });
});

describe('the hand-over code', () => {
  it('goes to the customer, not to staff screens', async () => {
    const { order } = await orders.placeOrder({ ...delivery, items }, guest);
    expect(order.handover).toMatch(/^\d{4}$/);
    expect(orders.publicOrder(order).handover).toBe(order.handover!);
    const seen = orders.staffView(order, rider) as Record<string, unknown>;
    expect(seen.handover).toBeUndefined();
    expect(seen.needsCode).toBe(true);
    expect(notify.orderMessage({ ...order, status: 'onway' })?.text).toContain(order.handover!);
  });

  it('a rider must enter it to finish; a manager can close it without', async () => {
    const o = await onTheRoad();
    await rejects(orders.staffAct(o.number, { type: 'delivered' }, rider), 400);
    await rejects(orders.staffAct(o.number, { type: 'delivered', code: o.handover === '0000' ? '1111' : '0000' }, rider), 400);
    const done = await orders.staffAct(o.number, { type: 'delivered', code: o.handover }, rider);
    expect(done.status).toBe('delivered');

    const p = await onTheRoad();
    expect((await orders.staffAct(p.number, { type: 'delivered' }, staff('manager'))).status).toBe('delivered');
  });

  it('locks after five wrong codes', async () => {
    const o = await onTheRoad();
    const wrong = o.handover === '0000' ? '1111' : '0000';
    for (let i = 0; i < 5; i++) await rejects(orders.staffAct(o.number, { type: 'delivered', code: wrong }, rider), 400);
    await rejects(orders.staffAct(o.number, { type: 'delivered', code: o.handover }, rider), 429);
  });
});

describe('the rider’s GPS', () => {
  it('only the rider on the delivery shares it, only on the road, and it is gone once delivered', async () => {
    const { order } = await orders.placeOrder({ ...delivery, items }, guest);
    await orders.staffAct(order.number, { type: 'take' }, rider);
    // not on the road yet: nothing kept
    expect(await orders.riderLocate(order.number, { lat: 31.5, lng: 74.3 }, rider)).toBe(false);
    await orders.staffAct(order.number, { type: 'ready' }, staff('manager'));
    await orders.staffAct(order.number, { type: 'pickup' }, rider);
    await rejects(orders.riderLocate(order.number, { lat: 31.5, lng: 74.3 }, staff('rider', 'someone-else')), 403);
    await rejects(orders.riderLocate(order.number, { lat: 51.5, lng: -0.1 }, rider), 400);

    expect(await orders.riderLocate(order.number, { lat: 31.51, lng: 74.34, heading: 370 }, rider)).toBe(true);
    const live = (await orders.getOrder(order.number))!;
    expect(await orders.riderFix(live)).toMatchObject({ lat: 31.51, lng: 74.34, heading: 10, loc: 0 });
    expect((await orders.riderFixes())[order.number]).toBeTruthy();

    await orders.staffAct(order.number, { type: 'delivered', code: order.handover }, rider);
    expect((await orders.riderFixes())[order.number]).toBeUndefined();
  });
});
