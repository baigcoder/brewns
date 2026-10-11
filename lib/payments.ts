/* Taking payment at the counter: what each way of paying needs, how the tax follows
   the way of paying, and how much change to give. Pure, so the till screen and the
   server agree on every rupee.

   Punjab taxes a restaurant bill at 16% when it is paid in cash and at 5% when it is
   paid by card or a mobile wallet, so the total depends on how the customer pays. */

import { TAX, TAX_CARD } from './catalog';
import type { Totals } from './orderFlow';

export type PayKind = 'cash' | 'card' | 'wallet';
/** Matches the order of `PAY` in the catalog: 0 cash, 1 card, 2 JazzCash / Easypaisa / Raast. */
export const PAY_KINDS: readonly PayKind[] = ['cash', 'card', 'wallet'];

export type Payment = { method: number; /** Cash handed over. Leave out for the exact amount. */ tendered?: number; /** Card approval code, or the wallet's transaction ID. */ ref?: string };

/** What is recorded on an order once it is paid. */
export type PaidRecord = { t: number; by: string; byId?: string; method: number; tendered?: number; change?: number; ref?: string };

export const CARD_REF = /^[A-Za-z0-9]{4,12}$/;
export const WALLET_REF = /^[A-Za-z0-9-]{6,30}$/;
const MAX_CASH = 1_000_000;

export const isPayMethod = (m: unknown): m is number => Number.isInteger(m) && (m as number) >= 0 && (m as number) < PAY_KINDS.length;

/** What is wrong with this payment for a bill of `total`, in words for the cashier, or '' when it is fine. */
export function paymentProblem(p: Payment, total: number): string {
  if (!isPayMethod(p.method)) return 'Pick cash, card or wallet.';
  const kind = PAY_KINDS[p.method];
  if (kind === 'cash') {
    if (p.tendered === undefined) return '';
    if (!Number.isInteger(p.tendered) || p.tendered < 0 || p.tendered > MAX_CASH) return 'Enter the cash received as a whole number of rupees.';
    return p.tendered < total ? `Rs ${(total - p.tendered).toLocaleString('en-US')} short of the bill.` : '';
  }
  const ref = (p.ref || '').trim();
  if (kind === 'card') return CARD_REF.test(ref) ? '' : 'Enter the approval code printed on the card machine’s slip (4 to 12 letters and numbers).';
  return WALLET_REF.test(ref) ? '' : 'Enter the transaction ID from the wallet receipt (6 to 30 letters and numbers).';
}

/** The same bill if it is paid another way: only the tax changes. Whole rupees, like `priceOrder`. */
export function retax(t: Totals, method: number): Totals {
  const rate = method > 0 ? TAX_CARD : TAX;
  const base = t.sub - t.discount;
  const tax = Math.round(base * rate);
  return { ...t, rate, tax, total: base + t.fee + tax };
}

/** The record to keep for a payment taken now. Change is worked out here, never trusted from the screen. */
export function paidRecord(p: Payment, total: number, who: { id: string; name: string }, t = Date.now()): PaidRecord {
  const kind = PAY_KINDS[p.method];
  const rec: PaidRecord = { t, by: who.name, byId: who.id, method: p.method };
  if (kind === 'cash') {
    const tendered = p.tendered ?? total;
    rec.tendered = tendered;
    rec.change = tendered - total;
  } else {
    const ref = (p.ref || '').trim().toUpperCase();
    if (ref) rec.ref = ref;
  }
  return rec;
}

/** Quick buttons for the cash handed over: the exact bill, then the next notes up the customer is likely to hand over. */
export function cashChoices(total: number): number[] {
  if (total <= 0) return [];
  const up = (step: number) => Math.ceil(total / step) * step;
  const out = [total, up(50), up(100), up(500), up(1000), up(5000)].filter((v) => v >= total);
  return [...new Set(out)].slice(0, 5);
}
