import { afterAll, beforeAll, describe, expect, it, mock, setSystemTime } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-test-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SMTP_USER;

// No browser session in a test: the caller is a guest.
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set() {}, delete() {} }), headers: async () => new Headers() }));

let voice: typeof import('@/lib/server/voiceCall');
let orders: typeof import('@/lib/server/orders');

beforeAll(async () => {
  setSystemTime(new Date('2026-03-04T07:00:00Z')); // noon in Lahore, open
  const auth = await import('@/lib/server/auth');
  await auth.saveUser(auth.newUser({ kind: 'staff', role: 'owner', name: 'Owner', email: 'owner@example.com', passHash: 'x' }));
  voice = await import('@/lib/server/voiceCall');
  orders = await import('@/lib/server/orders');
});
afterAll(() => {
  setSystemTime();
  rmSync(dir, { recursive: true, force: true });
});

const order = {
  items: [{ id: 'americano', qty: 2 }],
  mode: 'delivery',
  area: 1,
  address: 'House 12, Street 4, Block H, near the park',
  name: 'Sara Khan',
  phone: '0300 1234567',
  pay: 'cash',
};
const asked = 'That is two americanos to House 12, Street 4, Block H, Model Town, Rs 1,850 cash. Shall I place the order?';

describe('Sarah places an order on a call', () => {
  it('not without a read-back and a clear yes', async () => {
    const noAsk = await voice.runLiveTool('place_order', order, 'yes', 'Got it.');
    expect(noAsk.actions).toEqual([]);
    expect('error' in noAsk.output).toBe(true);
    const noYes = await voice.runLiveTool('place_order', order, 'no wait, change it', asked);
    expect(noYes.actions).toEqual([]);
  });

  it('after a yes it is a real order, on the kitchen screen, tracked like any other', async () => {
    const r = await voice.runLiveTool('place_order', order, 'yes please', asked);
    expect('result' in r.output).toBe(true);
    const said = JSON.parse((r.output as { result: string }).result);
    expect(said.placed).toBe(true);
    const placed = r.actions.find((a) => a.type === 'ORDER_PLACED') as { data: { order: { number: number; mode: string; area: number; address: string }; key: string } };
    expect(placed.data.order).toMatchObject({ mode: 'delivery', area: 1, address: order.address });
    const saved = await orders.getOrder(placed.data.order.number);
    expect(saved?.key).toBe(placed.data.key);
    expect(saved?.loc).toBe(0); // Model Town is sent from MM Alam Road
    expect(saved?.handover).toMatch(/^\d{4}$/);
    expect(said.order).toBe(`#${String(saved!.number).padStart(5, '0')}`);
  });

  it('asks for what is missing', async () => {
    const r = await voice.runLiveTool('place_order', { ...order, area: undefined }, 'yes', asked);
    expect((r.output as { error: string }).error).toMatch(/which area/i);
    const p = await voice.runLiveTool('place_order', { ...order, phone: '123' }, 'yes', asked);
    expect((p.output as { error: string }).error).toMatch(/mobile/i);
  });
});

describe('checking an order by phone', () => {
  const lookup = async (number: number, phone: string) => JSON.stringify((await voice.runLiveTool('check_order', { number, phone }, '', '')).output);
  it('stops a stranger walking through one order after a few wrong tries, even with the right number', async () => {
    const r = await voice.runLiveTool('place_order', { ...order, phone: '0311 7654321' }, 'yes please', asked);
    const number = (r.actions.find((a) => a.type === 'ORDER_PLACED') as { data: { order: { number: number } } }).data.order.number;
    expect(await lookup(number, '0311 7654321')).toContain('being made');
    for (let i = 0; i < 5; i++) expect(await lookup(number, `0300 555000${i}`)).toMatch(/No order found/);
    expect(await lookup(number, '0311 7654321')).toMatch(/No order found/);
  });
});
