/* The bill: subtotal, the club's free drink, a promo code, the delivery fee and
   Punjab sales tax. The checkout shows these numbers and the server works them
   out again from the catalog when the order arrives, so both always agree. */

import { rewardValue } from '@/components/brewns/club';
import { DELIVERY, TAX, TAX_CARD } from './catalog';
import type { Mode, Totals } from './orderFlow';

export type BillLine = { cat: string; qty: number; unit: number };

export function priceOrder(lines: BillLine[], o: { mode: Mode; area: number | null; pay: number; promoPct: number; useReward: boolean }): Totals {
  const sub = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  // A free drink comes off first, then any promo applies to the rest.
  const reward = o.useReward ? rewardValue(lines) : 0;
  const promo = Math.round((sub - reward) * o.promoPct);
  const discount = reward + promo;
  const fee = o.mode === 'delivery' && o.area !== null && sub - discount < DELIVERY.freeOver ? DELIVERY.areas[o.area][2] : 0;
  const rate = o.pay ? TAX_CARD : TAX;
  const tax = Math.round((sub - discount) * rate);
  return { sub, discount, promo, reward, fee, rate, tax, total: sub - discount + fee + tax };
}
