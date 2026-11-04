/* Refer a friend: the friend gets Rs 300 off a first order, and the customer who
   invited them gets a Rs 300 code of their own once that order is collected or
   delivered. Both travel as promo codes, so checkout needs no new box. Pure, so the
   server (which decides) and the tests share it. */

export const REFERRAL = { give: 300, get: 300, minOrder: 1000 } as const;

/** A customer's own code, to share; or a thank-you code, spendable once by its owner. */
export type RefCode = { kind: 'invite'; owner: string; ownerPhone: string } | { kind: 'thanks'; owner: string; amount: number; used?: number };

/** "Hassan Baig" → "HASSAN" + three digits; letters only, so it reads out loud. */
export const inviteCode = (name: string, digits: number) =>
  `${(name.trim().split(/\s+/)[0].normalize('NFKD').replace(/[^A-Za-z]/g, '').toUpperCase() || 'BREWNS').slice(0, 8)}${String(digits % 1000).padStart(3, '0')}`;

/**
 * Why this code can't be used on this order, as a sentence for the customer, or '' if it can.
 * `phone` is the order's mobile as digits; `usedBefore` is whether that mobile has had an invite discount.
 */
export function refProblem(c: RefCode | null, ctx: { customerId: string | null; phone: string; subtotal?: number; usedBefore?: boolean }): string {
  if (!c) return "That promo code isn't valid any more.";
  if (c.kind === 'thanks') {
    if (c.owner !== ctx.customerId) return 'Sign in to the account that earned this code to use it.';
    if (c.used) return 'You have already used that code.';
    return '';
  }
  if (c.owner === ctx.customerId || (ctx.phone && c.ownerPhone === ctx.phone)) return "That's your own code: send it to a friend instead.";
  if (ctx.usedBefore) return 'This mobile number has already had a friend’s discount.';
  if (ctx.subtotal !== undefined && ctx.subtotal < REFERRAL.minOrder) return `A friend’s code needs an order of Rs ${REFERRAL.minOrder.toLocaleString('en-US')} or more.`;
  return '';
}

/** Rupees the code takes off. */
export const refAmount = (c: RefCode) => (c.kind === 'thanks' ? c.amount : REFERRAL.give);
