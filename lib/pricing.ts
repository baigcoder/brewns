/* Server-side order pricing: verifies products, recalculates totals, validates promos,
   and computes Punjab Sales Tax so client numbers are never blindly trusted. */

import {
  productById,
  unitPrice,
  DELIVERY,
  TAX,
  TAX_CARD,
} from './catalog';

export type OrderItemInput = {
  id: string;
  sel?: Record<string, number>;
  qty: number;
  message?: string;
  name?: string;
  unitPrice?: number;
  station?: 'bar' | 'kitchen';
};

export type PricingResult = {
  sub: number;
  discount: number;
  fee: number;
  rate: number;
  tax: number;
  total: number;
  validItems: {
    id: string;
    name: string;
    sel: Record<string, number>;
    qty: number;
    unitPrice: number;
    station: 'bar' | 'kitchen';
  }[];
};

export function calculateOrderPricing({
  items,
  mode,
  area,
  pay,
  promoDiscount = 0,
}: {
  items: OrderItemInput[];
  mode: 'pickup' | 'delivery' | 'dinein';
  area?: number | null;
  pay: number; // 0: cash, 1: card, 2: jazzcash/easypaisa
  promoDiscount?: number; // e.g. 0.1 for 10%
}): PricingResult {
  const validItems = items
    .map((it) => {
      const p = productById(it.id);
      const q = Math.max(1, Math.min(50, Math.floor(it.qty || 1)));
      if (p) {
        const u = unitPrice(p, it.sel || {});
        return {
          id: p.id,
          name: p.name,
          sel: it.sel || {},
          qty: q,
          unitPrice: u,
          station: p.station,
        };
      } else if (it.name && it.unitPrice !== undefined) {
        return {
          id: it.id || `custom-${Date.now()}`,
          name: it.name,
          sel: it.sel || {},
          qty: q,
          unitPrice: Math.max(0, it.unitPrice),
          station: it.station || 'bar',
        };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const sub = validItems.reduce((acc, it) => acc + it.unitPrice * it.qty, 0);
  const discount = Math.round(sub * Math.max(0, Math.min(1, promoDiscount)));
  const netSub = sub - discount;

  let fee = 0;
  if (mode === 'delivery' && area !== undefined && area !== null && DELIVERY.areas[area]) {
    if (netSub < DELIVERY.freeOver) {
      fee = DELIVERY.areas[area][2];
    }
  }

  // 16% on cash, 5% on card or digital payment (Raast, JazzCash, Easypaisa)
  const rate = pay === 0 ? TAX : TAX_CARD;
  const tax = Math.round(netSub * rate);
  const total = netSub + fee + tax;

  return {
    sub,
    discount,
    fee,
    rate,
    tax,
    total,
    validItems,
  };
}
