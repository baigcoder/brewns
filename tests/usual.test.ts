import { describe, expect, it } from 'bun:test';
import { usualOf } from '@/lib/usual';

const line = (id: string, sel: Record<string, number> = {}, qty = 1) => ({ id, sel, qty, name: id.toUpperCase() });
const order = (placed: number, items: ReturnType<typeof line>[], status = 'delivered') => ({ placed, status, items });

describe('usualOf', () => {
  it('ranks by how many orders had the same item and options', () => {
    const u = usualOf([
      order(1, [line('flat-white', { milk: 1 }), line('croissant')]),
      order(2, [line('flat-white', { milk: 1 })]),
      order(3, [line('flat-white', { milk: 0 }), line('croissant')]),
      order(4, [line('croissant')]),
    ]);
    expect(u.map((x) => x.id)).toEqual(['croissant', 'flat-white']);
    expect(u[0].times).toBe(3);
    expect(u[1].sel).toEqual({ milk: 1 }); // the oat one; the whole-milk one was ordered once
  });

  it('treats option order as irrelevant and counts an order once however many units', () => {
    const u = usualOf([order(1, [line('latte', { a: 1, b: 2 }, 3)]), order(2, [line('latte', { b: 2, a: 1 })])]);
    expect(u).toHaveLength(1);
    expect(u[0].times).toBe(2);
    expect(u[0].qty).toBe(4);
  });

  it('ignores cancelled orders and one-offs, and breaks ties by recency', () => {
    expect(usualOf([order(1, [line('a')], 'cancelled'), order(2, [line('a')])])).toEqual([]);
    const u = usualOf([order(1, [line('old')]), order(2, [line('old')]), order(3, [line('new')]), order(4, [line('new')])]);
    expect(u.map((x) => x.id)).toEqual(['new', 'old']);
  });
});
