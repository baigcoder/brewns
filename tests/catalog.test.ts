import { describe, expect, it } from 'bun:test';
import { CATALOG, catalogItem, pkMobile, unitPrice, validSel } from '@/lib/catalog';

describe('Catalog & Helpers', () => {
  it('correctly retrieves catalog items by id', () => {
    const item = catalogItem('slow-roast');
    expect(item).toBeDefined();
    expect(item?.name).toBe('SLOW ROAST');
    expect(item?.cat).toBe('beans');
  });

  it('calculates unit prices including selected option deltas', () => {
    const burger = catalogItem('smash-burger');
    expect(burger).toBeDefined();
    if (!burger) return;

    // Default burger with no extras
    const basePrice = unitPrice(burger, {});
    expect(basePrice).toBe(burger.price);

    // Burger with meal (+450) and extra patty (+400)
    const mealWithExtra = unitPrice(burger, {
      meal: 1, // +450
      extra: 2, // +400
    });
    expect(mealWithExtra).toBe(burger.price + 450 + 400);
  });

  it('validates option choices strictly', () => {
    const burger = catalogItem('smash-burger');
    if (!burger) return;

    expect(validSel(burger, { meal: 0, extra: 0 })).toBe(true);
    expect(validSel(burger, { meal: 1, extra: 1 })).toBe(true);
    // Invalid option index (out of range)
    expect(validSel(burger, { meal: 99 })).toBe(false);
  });

  it('validates Pakistani mobile phone numbers correctly', () => {
    // Valid standard numbers
    expect(pkMobile('0300 1234567')).toBe('0300 1234567');
    expect(pkMobile('0321-9876543')).toBe('0321 9876543');
    expect(pkMobile('+92 345 1122334')).toBe('0345 1122334');
    expect(pkMobile('0092 301 1234567')).toBe('0301 1234567');

    // Invalid numbers
    expect(pkMobile('12345')).toBe('');
    expect(pkMobile('021-34567890')).toBe(''); // Landline, not mobile
    expect(pkMobile('not a number')).toBe('');
  });
});
