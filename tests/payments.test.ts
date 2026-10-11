import { describe, expect, it } from 'bun:test';
import { cashChoices, paidRecord, paymentProblem, retax } from '@/lib/payments';
import { priceOrder } from '@/lib/pricing';

const lines = [
  { cat: 'drinks', qty: 2, unit: 600 },
  { cat: 'bakery', qty: 1, unit: 450 },
]; // Rs 1,650
const bill = (pay: number) => priceOrder(lines, { mode: 'pickup', area: null, pay, promoPct: 0, useReward: false });

describe('paymentProblem', () => {
  it('lets cash through, exact or more, and refuses less', () => {
    expect(paymentProblem({ method: 0 }, 1914)).toBe('');
    expect(paymentProblem({ method: 0, tendered: 2000 }, 1914)).toBe('');
    expect(paymentProblem({ method: 0, tendered: 1914 }, 1914)).toBe('');
    expect(paymentProblem({ method: 0, tendered: 1900 }, 1914)).toBe('Rs 14 short of the bill.');
  });

  it('refuses cash that is not a whole number of rupees', () => {
    expect(paymentProblem({ method: 0, tendered: 2000.5 }, 1914)).toContain('whole number');
    expect(paymentProblem({ method: 0, tendered: -5 }, 1914)).toContain('whole number');
    expect(paymentProblem({ method: 0, tendered: Number.NaN }, 1914)).toContain('whole number');
    expect(paymentProblem({ method: 0, tendered: 99_999_999 }, 1914)).toContain('whole number');
  });

  it('needs the card machine approval code for a card', () => {
    expect(paymentProblem({ method: 1 }, 1000)).toContain('approval code');
    expect(paymentProblem({ method: 1, ref: '12' }, 1000)).toContain('approval code');
    expect(paymentProblem({ method: 1, ref: '482915' }, 1000)).toBe('');
    expect(paymentProblem({ method: 1, ref: 'AB 1234' }, 1000)).toContain('approval code');
  });

  it('needs the transaction ID for a wallet', () => {
    expect(paymentProblem({ method: 2 }, 1000)).toContain('transaction ID');
    expect(paymentProblem({ method: 2, ref: '123' }, 1000)).toContain('transaction ID');
    expect(paymentProblem({ method: 2, ref: 'TXN-3847291056' }, 1000)).toBe('');
  });

  it('refuses a way of paying that does not exist', () => {
    expect(paymentProblem({ method: 3 }, 1000)).toContain('cash, card or wallet');
    expect(paymentProblem({ method: -1 }, 1000)).toContain('cash, card or wallet');
    expect(paymentProblem({ method: 1.5 }, 1000)).toContain('cash, card or wallet');
  });
});

describe('tax follows the way of paying', () => {
  it('is 16% on cash and 5% on card or wallet', () => {
    expect(bill(0).rate).toBe(0.16);
    expect(bill(0).tax).toBe(264);
    expect(bill(1).rate).toBe(0.05);
    expect(bill(1).tax).toBe(83); // 82.5 rounds up
    expect(bill(2).tax).toBe(83);
  });

  it('retax gives the same bill priceOrder would have, either way', () => {
    expect(retax(bill(0), 1)).toEqual(bill(1));
    expect(retax(bill(1), 0)).toEqual(bill(0));
    expect(retax(bill(0), 2)).toEqual(bill(2));
  });

  it('keeps discounts and the delivery fee out of the way', () => {
    const d = priceOrder(lines, { mode: 'delivery', area: 0, pay: 0, promoPct: 0.1, useReward: false });
    const c = priceOrder(lines, { mode: 'delivery', area: 0, pay: 1, promoPct: 0.1, useReward: false });
    expect(retax(d, 1)).toEqual(c);
  });
});

describe('paidRecord', () => {
  const who = { id: 'u1', name: 'Ayesha' };
  it('works out the change itself', () => {
    expect(paidRecord({ method: 0, tendered: 2000 }, 1914, who, 5)).toEqual({ t: 5, by: 'Ayesha', byId: 'u1', method: 0, tendered: 2000, change: 86 });
  });
  it('takes exact cash when no amount is given', () => {
    expect(paidRecord({ method: 0 }, 1914, who, 5)).toMatchObject({ tendered: 1914, change: 0 });
  });
  it('keeps the approval code of a card, tidied', () => {
    expect(paidRecord({ method: 1, ref: ' ab12cd ' }, 1000, who, 5)).toEqual({ t: 5, by: 'Ayesha', byId: 'u1', method: 1, ref: 'AB12CD' });
  });
});

describe('cashChoices', () => {
  it('offers the exact bill first, then notes upward without repeats', () => {
    expect(cashChoices(1914)).toEqual([1914, 1950, 2000, 5000]);
    expect(cashChoices(2000)).toEqual([2000, 5000]);
    expect(cashChoices(120)).toEqual([120, 150, 200, 500, 1000]);
    expect(cashChoices(0)).toEqual([]);
  });
  it('never offers less than the bill', () => {
    for (const total of [1, 49, 51, 499, 1001, 4999, 12345]) for (const v of cashChoices(total)) expect(v).toBeGreaterThanOrEqual(total);
  });
});
