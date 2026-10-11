import { afterAll, beforeAll, beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { catalogItem, defaultSel } from '@/lib/catalog';
import { DEFAULT_ROLE_PERMS } from '@/lib/rbac';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-tables-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TWILIO_ACCOUNT_SID;

let orders: typeof import('@/lib/server/orders');
let settings: typeof import('@/lib/server/settings');
let codes: typeof import('@/lib/server/tableCodes');

beforeAll(async () => {
  orders = await import('@/lib/server/orders');
  settings = await import('@/lib/server/settings');
  codes = await import('@/lib/server/tableCodes');
});
beforeEach(() => setSystemTime(new Date('2026-03-04T07:00:00Z')));
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const rejects = async (p: Promise<unknown>, status: number) => {
  let err: { status?: number } | null = null;
  await p.catch((e) => (err = e));
  expect((err as { status?: number } | null)?.status).toBe(status);
};

const guest = { kind: 'online', customer: null, guestReward: false } as const;
const waiter = { user: { id: 'u-w', name: 'Waiter', role: 'cashier', shops: [] }, role: 'cashier', perms: DEFAULT_ROLE_PERMS.cashier, settings: {} } as never;
const base = { loc: 0, area: null, address: '', when: 'asap', name: 'Sara Khan', phone: '0300 1234567', email: '', note: '', pay: 0, promo: '', useReward: false, mode: 'dinein' } as const;
const items = () => [{ id: 'americano', qty: 1, sel: defaultSel(catalogItem('americano')!) }];
const protect = (on: boolean) => settings.updateSettings((s) => void (s.signedTables = on));

describe('table codes', () => {
  it('make a different code for each table and shop, the same one every time', async () => {
    const a = await codes.tableKey(0, 3);
    expect(a).toBe(await codes.tableKey(0, 3));
    expect(a).not.toBe(await codes.tableKey(0, 4));
    expect(a).not.toBe(await codes.tableKey(1, 3));
    expect(a.length).toBe(16);
  });

  it('check out only for the right table', async () => {
    const k = await codes.tableKey(0, 3);
    expect(await codes.tableKeyOk(0, 3, k)).toBe(true);
    expect(await codes.tableKeyOk(0, 4, k)).toBe(false);
    expect(await codes.tableKeyOk(0, 3, 'x'.repeat(16))).toBe(false);
    expect(await codes.tableKeyOk(0, 3, undefined)).toBe(false);
    expect(await codes.tableKeyOk(0, 3, 42)).toBe(false);
  });
});

describe('with protection off (the default), as before', () => {
  it('takes a table order and a waiter call without a code', async () => {
    await protect(false);
    const { order } = await orders.placeOrder({ ...base, items: items(), table: 3 }, guest);
    expect(order.mode).toBe('dinein');
    const call = await orders.callWaiter(0, 3, 'waiter', await settings.getSettings());
    expect(call.table).toBe(3);
  });
});

describe('with protection on', () => {
  it('refuses a table order from the site without the table’s code, or with another table’s', async () => {
    await protect(true);
    await rejects(orders.placeOrder({ ...base, items: items(), table: 3 }, guest), 403);
    await rejects(orders.placeOrder({ ...base, items: items(), table: 3, tableKey: await codes.tableKey(0, 4) }, guest), 403);
    await rejects(orders.placeOrder({ ...base, items: items(), table: 3, tableKey: 'forged-forged-fo' }, guest), 403);
  });

  it('takes it with the right code', async () => {
    await protect(true);
    const { order } = await orders.placeOrder({ ...base, items: items(), table: 3, tableKey: await codes.tableKey(0, 3) }, guest);
    expect(order.table).toBe(3);
  });

  it('never asks a waiter ringing up a table order at the counter', async () => {
    await protect(true);
    const { order } = await orders.placeOrder({ ...base, items: items(), table: 3, phone: '', name: '' }, { kind: 'staff', ctx: waiter, source: 'table' });
    expect(order.source).toBe('table');
  });

  it('does not ask for it on pickup orders', async () => {
    await protect(true);
    const { order } = await orders.placeOrder({ ...base, items: items(), mode: 'pickup', table: null }, guest);
    expect(order.mode).toBe('pickup');
  });

  it('refuses a waiter call without the code and takes it with the code', async () => {
    await protect(true);
    const s = await settings.getSettings();
    await rejects(orders.callWaiter(0, 5, 'waiter', s), 403);
    await rejects(orders.callWaiter(0, 5, 'bill', s, await codes.tableKey(0, 6)), 403);
    const call = await orders.callWaiter(0, 5, 'bill', s, await codes.tableKey(0, 5));
    expect(call).toMatchObject({ loc: 0, table: 5, kind: 'bill' });
  });
});
