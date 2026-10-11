import { describe, expect, it } from 'bun:test';
import { promoProblem, promoRulesLabel, type PromoRules } from '@/lib/promos';

const base: PromoRules = { code: 'EID20', pct: 20, active: true };
const ctx = { uses: 0, today: '2026-03-10' };

describe('promoProblem', () => {
  it('lets a plain active code through, as before', () => {
    expect(promoProblem(base, ctx)).toBe('');
    expect(promoProblem(base, { ...ctx, uses: 5000, subtotal: 10, usedByThisCustomer: true })).toBe('');
  });

  it('refuses a missing or switched-off code', () => {
    expect(promoProblem(undefined, ctx)).toBe("That promo code isn't valid any more.");
    expect(promoProblem({ ...base, active: false }, ctx)).toBe("That promo code isn't valid any more.");
  });

  it('works on its last day and not the day after', () => {
    expect(promoProblem({ ...base, expires: '2026-03-10' }, ctx)).toBe('');
    expect(promoProblem({ ...base, expires: '2026-03-09' }, ctx)).toBe('That code ended on 9 Mar.');
  });

  it('stops once the cap is reached', () => {
    expect(promoProblem({ ...base, maxUses: 100 }, { ...ctx, uses: 99 })).toBe('');
    expect(promoProblem({ ...base, maxUses: 100 }, { ...ctx, uses: 100 })).toBe('That code has been used up.');
  });

  it('needs the minimum order, but only when the bill is known', () => {
    const p = { ...base, minTotal: 1500 };
    expect(promoProblem(p, ctx)).toBe(''); // the code check before an order exists
    expect(promoProblem(p, { ...ctx, subtotal: 1499 })).toBe('That code needs an order of Rs 1,500 or more.');
    expect(promoProblem(p, { ...ctx, subtotal: 1500 })).toBe('');
  });

  it('allows once per customer only when asked for', () => {
    expect(promoProblem({ ...base, oncePerCustomer: true }, { ...ctx, usedByThisCustomer: false })).toBe('');
    expect(promoProblem({ ...base, oncePerCustomer: true }, { ...ctx, usedByThisCustomer: true })).toBe('You have already used that code.');
  });

  it('reports the end date before the cap when both apply', () => {
    expect(promoProblem({ ...base, expires: '2026-03-01', maxUses: 1 }, { ...ctx, uses: 9 })).toBe('That code ended on 1 Mar.');
  });
});

describe('promoRulesLabel', () => {
  it('summarises the rules for the staff list', () => {
    expect(promoRulesLabel({})).toBe('');
    expect(promoRulesLabel({ expires: '2026-03-03', minTotal: 1500, oncePerCustomer: true })).toBe('ends 3 Mar · min Rs 1,500 · once each');
  });
});
