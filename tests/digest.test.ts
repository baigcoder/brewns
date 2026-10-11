import { describe, expect, it } from 'bun:test';
import { digestMessage, type DigestInput } from '@/lib/server/digest';

const kpis = { gross: 84250, net: 70100, orders: 61, avg: 1381, cancelled: 0, refundsPending: 0, unpaid: 0, prepMin: 9.4, onTimePct: 92 };
const base: DigestInput = {
  day: '2026-03-10',
  kpis,
  prev: { gross: 75000, orders: 55 },
  top: [
    { name: 'Flat white', qty: 40 },
    { name: 'Americano', qty: 31 },
    { name: 'Croissant', qty: 22 },
    { name: 'Cold brew', qty: 9 },
  ],
  byShop: [
    { loc: 0, gross: 50000, orders: 35 },
    { loc: 1, gross: 34250, orders: 26 },
    { loc: 2, gross: 0, orders: 0 },
  ],
};

describe('digestMessage', () => {
  it('says nothing on a day with no orders', () => {
    expect(digestMessage({ ...base, kpis: { ...kpis, orders: 0, gross: 0 } })).toBeNull();
  });

  it('puts the money and the comparison in the subject and body', () => {
    const m = digestMessage(base)!;
    expect(m.subject).toContain('Rs 84,250');
    expect(m.subject).toContain('61 orders');
    expect(m.subject).toContain('Tuesday 10 March');
    expect(m.text).toContain('up 12% on the same day last week');
    expect(m.text).toContain('1. Flat white: 40');
    expect(m.text).not.toContain('4. Cold brew'); // the top three only
  });

  it('lists shops only when there is more than one with sales', () => {
    expect(digestMessage(base)!.text).toContain('By shop:');
    expect(digestMessage({ ...base, byShop: [base.byShop[0]] })!.text).not.toContain('By shop:');
  });

  it('flags what needs attention, and only that', () => {
    expect(digestMessage(base)!.text).not.toContain('Needs a look');
    const t = digestMessage({ ...base, kpis: { ...kpis, cancelled: 2, refundsPending: 1500, unpaid: 3000 } })!.text;
    expect(t).toContain('2 cancelled');
    expect(t).toContain('Rs 1,500 in refunds still to send');
    expect(t).toContain('Rs 3,000 not yet marked paid');
  });

  it('copes with no comparison day and a single order', () => {
    const m = digestMessage({ ...base, prev: { gross: 0, orders: 0 }, kpis: { ...kpis, orders: 1, gross: 900, avg: 900 } })!;
    expect(m.subject).toContain('1 order');
    expect(m.subject).not.toContain('1 orders');
    expect(m.text).not.toContain('last week');
  });
});
