import { describe, expect, it } from 'bun:test';
import { priceOrder } from '@/lib/pricing';
import { DELIVERY, TAX, TAX_CARD } from '@/lib/catalog';

describe('Pricing Engine', () => {
  it('calculates cash order subtotal and 16% Punjab Sales Tax', () => {
    const lines = [{ cat: 'drinks', qty: 2, unit: 500 }];
    const totals = priceOrder(lines, {
      mode: 'pickup',
      area: null,
      pay: 0, // Cash
      promoPct: 0,
      useReward: false,
    });

    expect(totals.sub).toBe(1000);
    expect(totals.discount).toBe(0);
    expect(totals.fee).toBe(0);
    expect(totals.rate).toBe(TAX); // 16%
    expect(totals.tax).toBe(Math.round(1000 * TAX));
    expect(totals.total).toBe(1000 + Math.round(1000 * TAX));
  });

  it('applies 5% concessional tax rate for card/wallet payments', () => {
    const lines = [{ cat: 'kitchen', qty: 1, unit: 1500 }];
    const totals = priceOrder(lines, {
      mode: 'pickup',
      area: null,
      pay: 1, // Card / Wallet
      promoPct: 0,
      useReward: false,
    });

    expect(totals.sub).toBe(1500);
    expect(totals.rate).toBe(TAX_CARD); // 5%
    expect(totals.tax).toBe(Math.round(1500 * TAX_CARD));
    expect(totals.total).toBe(1500 + Math.round(1500 * TAX_CARD));
  });

  it('charges delivery fee for orders below free delivery threshold', () => {
    const lines = [{ cat: 'drinks', qty: 2, unit: 600 }]; // 1200 subtotal
    const areaIndex = 0;
    const expectedFee = DELIVERY.areas[areaIndex][2];

    const totals = priceOrder(lines, {
      mode: 'delivery',
      area: areaIndex,
      pay: 0,
      promoPct: 0,
      useReward: false,
    });

    expect(totals.sub).toBe(1200);
    expect(totals.fee).toBe(expectedFee);
    expect(totals.total).toBe(totals.sub + totals.fee + totals.tax);
  });

  it('grants free delivery for orders above free delivery threshold (Rs 3000)', () => {
    const lines = [{ cat: 'beans', qty: 1, unit: 3800 }];
    const areaIndex = 0;

    const totals = priceOrder(lines, {
      mode: 'delivery',
      area: areaIndex,
      pay: 1,
      promoPct: 0,
      useReward: false,
    });

    expect(totals.sub).toBe(3800);
    expect(totals.fee).toBe(0); // Free
  });

  it('applies promo code discounts correctly', () => {
    const lines = [{ cat: 'drinks', qty: 1, unit: 1000 }];
    const totals = priceOrder(lines, {
      mode: 'pickup',
      area: null,
      pay: 0,
      promoPct: 0.15, // 15% discount
      useReward: false,
    });

    expect(totals.sub).toBe(1000);
    expect(totals.promo).toBe(150);
    expect(totals.discount).toBe(150);
    expect(totals.tax).toBe(Math.round(850 * TAX));
    expect(totals.total).toBe(850 + Math.round(850 * TAX));
  });
});
