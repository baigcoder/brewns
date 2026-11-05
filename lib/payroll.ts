/* Pay at brewns: each team member's monthly salary, and what changes it in a given month.

   The owner sets a monthly salary and a pay day for each person. Through the month they
   add what changes it: a bonus or overtime on top, a deduction (late, absence, breakage)
   or an advance being repaid taken off. On pay day they mark it paid, and that month's
   figures are frozen. Everyone sees their own pay for this month and the months before.
   Pure: shared by the server and the console. */

import { pkDay } from './orderFlow';

export const PAY_KINDS = {
  bonus: { label: 'Bonus', sign: 1 },
  overtime: { label: 'Overtime', sign: 1 },
  deduction: { label: 'Deduction', sign: -1 },
  advance: { label: 'Advance repaid', sign: -1 },
} as const;
export type PayKind = keyof typeof PAY_KINDS;

export const PAY_METHODS = ['Bank transfer', 'Cash', 'JazzCash / Easypaisa'] as const;

export type PayItem = { id: string; kind: PayKind; amount: number; note: string; at: number; by: string };
/** A person's month: the changes, and once paid, what was paid (salary frozen at that moment). */
export type PayMonth = { items: PayItem[]; paid?: { at: number; by: string; method: string; ref: string; base: number; net: number } };
/** A person's standing pay: monthly salary in rupees and the day of the month it is paid. */
export type PayPlan = { salary: number; payDay: number };

export const DEFAULT_PAY_DAY = 1;
export const MAX_PAY = 5_000_000;

/** "2026-11", the Lahore calendar month. */
export const monthOf = (t: number) => pkDay(t).slice(0, 7);
export const isMonth = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
/** The month before or after `m` (`by` months away). */
export const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** What the month comes to: salary, plus additions, minus deductions. Never below zero. */
export function payTotals(base: number, items: PayItem[]) {
  const add = items.filter((i) => PAY_KINDS[i.kind].sign > 0).reduce((s, i) => s + i.amount, 0);
  const less = items.filter((i) => PAY_KINDS[i.kind].sign < 0).reduce((s, i) => s + i.amount, 0);
  return { base, add, less, net: Math.max(0, base + add - less) };
}

/** The salary a month is worked out on: frozen once paid, the current salary until then. */
export const monthBase = (plan: PayPlan | null | undefined, month: PayMonth | null | undefined) => month?.paid?.base ?? plan?.salary ?? 0;
