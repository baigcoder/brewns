import { describe, expect, it } from 'bun:test';
import type { ServerOrder } from '@/lib/orderFlow';
import { exceptionsOf } from '@/lib/server/reports';
import { SHORT_ALERT, tillSummary, varianceLabel } from '@/lib/till';

let n = 1;
const order = (over: Partial<ServerOrder> = {}): ServerOrder =>
  ({ number: n++, status: 'accepted', totals: { total: 1000 }, events: [], refund: undefined, paid: null, ...over }) as ServerOrder;
const cancelled = (by: string, role: string, total = 1000) => order({ status: 'cancelled', totals: { total } as ServerOrder['totals'], events: [{ t: 1, what: 'placed', by, role }, { t: 2, what: 'cancelled', status: 'cancelled', by, role }] });

describe('exceptionsOf', () => {
  it('counts what each person cancelled and refunded, biggest first', () => {
    const rows = exceptionsOf([
      cancelled('Ayesha', 'cashier', 1000),
      cancelled('Ayesha', 'cashier', 2500),
      cancelled('Bilal', 'manager', 400),
      order({ refund: { amount: 700, state: 'pending', reason: 'x', at: 1, by: 'Bilal', method: 0 } }),
    ]);
    expect(rows[0]).toEqual({ name: 'Ayesha', role: 'cashier', cancels: 2, cancelValue: 3500, refunds: 0, refundValue: 0 });
    expect(rows[1]).toEqual({ name: 'Bilal', role: 'manager', cancels: 1, cancelValue: 400, refunds: 1, refundValue: 700 });
  });

  it('leaves out customers cancelling their own order and the system timing out unpaid ones', () => {
    const rows = exceptionsOf([cancelled('Customer', ''), cancelled('Auto', ''), cancelled('Auto-accept', '')]);
    expect(rows).toEqual([]);
  });

  it('ignores orders that were not cancelled and carry no refund', () => {
    expect(exceptionsOf([order(), order()])).toEqual([]);
  });

  it('shows at most eight people', () => {
    const many = Array.from({ length: 12 }, (_, i) => cancelled(`Person ${i}`, 'cashier', 100 + i));
    expect(exceptionsOf(many)).toHaveLength(8);
  });
});

describe('closing the till', () => {
  const me = { id: 'u1', name: 'Ayesha' };
  const sale = (total: number, t: number) => order({ totals: { total } as ServerOrder['totals'], paid: { t, by: 'Ayesha', byId: 'u1', method: 0 } });

  it('counts only what was taken since the last close', () => {
    const orders = [sale(1000, 100), sale(500, 200), sale(700, 400)];
    expect(tillSummary(orders, me, 0, 0).cash).toBe(2200);
    expect(tillSummary(orders, me, 0, 250).cash).toBe(700); // the first two belong to the shift already closed
    expect(tillSummary(orders, me, 0, 400).cash).toBe(0);
  });

  it('starts the next shift’s drawer from the new float alone', () => {
    expect(tillSummary([sale(1000, 100)], me, 3000, 150).drawer).toBe(3000);
  });

  it('reads a difference in words, short or over', () => {
    expect(varianceLabel(0)).toBe('Exact');
    expect(varianceLabel(-350)).toBe('Short Rs 350');
    expect(varianceLabel(1200)).toBe('Over Rs 1,200');
  });

  it('tells the owner about a drawer well short and not about a few rupees', () => {
    expect(SHORT_ALERT).toBeGreaterThanOrEqual(100);
    expect(-50 <= -SHORT_ALERT).toBe(false);
    expect(-500 <= -SHORT_ALERT).toBe(true);
  });
});
