import { describe, expect, it } from 'bun:test';
import type { ServerOrder } from '@/lib/orderFlow';
import { tillSummary } from '@/lib/till';

const me = { id: 'u1', name: 'Ayesha' };
let n = 1;
const o = (total: number, paid: ServerOrder['paid'], over: Partial<ServerOrder> = {}): ServerOrder =>
  ({ number: n++, placed: n * 1000, mode: 'pickup', table: null, name: 'Walk-in', status: 'accepted', totals: { total }, paid, ...over }) as ServerOrder;
const cash = (by = me) => ({ t: 1, by: by.name, byId: by.id, method: 0 });

describe('tillSummary', () => {
  it('adds up what I took by way of paying', () => {
    const t = tillSummary([o(1000, cash()), o(500, cash()), o(2000, { t: 1, by: 'Ayesha', byId: 'u1', method: 1 }), o(300, { t: 1, by: 'Ayesha', byId: 'u1', method: 2 })], me);
    expect(t).toMatchObject({ orders: 4, cash: 1500, card: 2000, wallet: 300 });
  });

  it('leaves out the sales of other cashiers and unpaid orders', () => {
    const t = tillSummary([o(1000, cash()), o(999, cash({ id: 'u2', name: 'Bilal' })), o(777, null)], me);
    expect(t.orders).toBe(1);
    expect(t.cash).toBe(1000);
  });

  it('still counts a payment saved before cashiers were recorded by id', () => {
    expect(tillSummary([o(400, { t: 1, by: 'Ayesha', method: 0 })], me).cash).toBe(400);
  });

  it('does not count a cancelled order as a sale', () => {
    expect(tillSummary([o(1000, cash(), { status: 'cancelled' })], me)).toMatchObject({ orders: 0, cash: 0 });
  });

  it('works out the cash that should be in the drawer: float plus cash sales minus cash refunds', () => {
    const refund = { amount: 200, state: 'paid', method: 0, paidBy: 'Ayesha', paidAt: 5 } as ServerOrder['refund'];
    const t = tillSummary([o(1000, cash()), o(500, { t: 1, by: 'Ayesha', byId: 'u1', method: 1 }), o(300, cash(), { refund })], me, 5000);
    expect(t.cash).toBe(1300);
    expect(t.refundsCash).toBe(200);
    expect(t.drawer).toBe(5000 + 1300 - 200);
  });

  it('ignores a nonsense float', () => {
    expect(tillSummary([], me, -5).float).toBe(0);
    expect(tillSummary([], me, 12.5).float).toBe(0);
  });

  it('lists the latest bills first, at most eight', () => {
    const orders = Array.from({ length: 12 }, () => o(100, cash()));
    const t = tillSummary(orders, me);
    expect(t.recent).toHaveLength(8);
    expect(t.recent[0].number).toBeGreaterThan(t.recent[7].number);
  });
});
