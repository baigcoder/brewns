/* When a promo code may be used. A code used to be valid for as long as it was
   switched on, by anyone, any number of times. Now it can also end on a date, stop
   after a number of uses, need a minimum order, and be limited to once per
   customer. Pure, so the server (which decides) and the tests share it. */

export type PromoRules = {
  code: string;
  pct: number;
  active: boolean;
  /** Stops working after this many orders have used it. */
  maxUses?: number;
  /** Last day it works, as YYYY-MM-DD in Lahore time. */
  expires?: string;
  /** Smallest bill (before the discount) it applies to, in rupees. */
  minTotal?: number;
  /** One order per customer, told apart by mobile number. */
  oncePerCustomer?: boolean;
};

export const PROMO_MAX_PCT = 50;

const niceDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Why this code can't be used right now, as a sentence for the customer, or '' if it can.
 * `subtotal` and `usedByThisCustomer` are only known when an order is being placed.
 */
export function promoProblem(p: PromoRules | undefined, ctx: { uses: number; today: string; subtotal?: number; usedByThisCustomer?: boolean }): string {
  if (!p || !p.active) return "That promo code isn't valid any more.";
  if (p.expires && ctx.today > p.expires) return `That code ended on ${niceDay(p.expires)}.`;
  if (p.maxUses !== undefined && ctx.uses >= p.maxUses) return 'That code has been used up.';
  if (p.oncePerCustomer && ctx.usedByThisCustomer) return 'You have already used that code.';
  if (p.minTotal && ctx.subtotal !== undefined && ctx.subtotal < p.minTotal) return `That code needs an order of Rs ${p.minTotal.toLocaleString('en-US')} or more.`;
  return '';
}

/** A short line for the staff list: "ends 3 Mar · min Rs 1,500 · once each". */
export function promoRulesLabel(p: Pick<PromoRules, 'maxUses' | 'expires' | 'minTotal' | 'oncePerCustomer'>): string {
  return [p.expires ? `ends ${niceDay(p.expires)}` : '', p.minTotal ? `min Rs ${p.minTotal.toLocaleString('en-US')}` : '', p.oncePerCustomer ? 'once each' : ''].filter(Boolean).join(' · ');
}
