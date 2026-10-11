import { describe, expect, it } from 'bun:test';
import { CATALOG } from '@/lib/catalog';
import { DIET, dietBadges, matchesDiet } from '@/lib/diet';

describe('diet table', () => {
  it('only lists items that are on the menu', () => {
    const ids = new Set(CATALOG.map((p) => p.id));
    for (const id of Object.keys(DIET)) expect(ids.has(id)).toBe(true);
  });

  it('covers every food and drink (merch and gift cards have no diet facts)', () => {
    const missing = CATALOG.filter((p) => p.cat !== 'merch' && p.cat !== 'gifts' && !DIET[p.id]).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it('never lists dairy or egg on a vegan item', () => {
    for (const [id, d] of Object.entries(DIET)) {
      if (d.diet === 'vegan') expect([id, d.allergens.filter((a) => a === 'dairy' || a === 'egg')]).toEqual([id, []]);
    }
  });
});

describe('matchesDiet', () => {
  it('lets everything through with no filter', () => {
    expect(matchesDiet('smash-burger', [])).toBe(true);
  });

  it('keeps meat out of vegetarian and vegan', () => {
    expect(matchesDiet('smash-burger', ['vegetarian'])).toBe(false);
    expect(matchesDiet('margherita-pizza', ['vegetarian'])).toBe(true);
    expect(matchesDiet('margherita-pizza', ['vegan'])).toBe(false);
    expect(matchesDiet('lime-soda', ['vegan'])).toBe(true);
  });

  it('counts an oat-milk swap as dairy-free and vegan, but honey keeps the smoothie off vegan', () => {
    expect(matchesDiet('latte', ['no-dairy'])).toBe(true);
    expect(matchesDiet('latte', ['vegan'])).toBe(true);
    expect(matchesDiet('spanish-latte', ['no-dairy'])).toBe(false);
    expect(matchesDiet('mango-smoothie', ['no-dairy'])).toBe(true);
    expect(matchesDiet('mango-smoothie', ['vegan'])).toBe(false);
  });

  it('treats the financier as wheat-free but not nut-free', () => {
    expect(matchesDiet('matcha-financier', ['no-gluten'])).toBe(true);
    expect(matchesDiet('matcha-financier', ['no-nuts'])).toBe(false);
  });

  it('combines filters, and never matches items without diet facts', () => {
    expect(matchesDiet('latte', ['vegan', 'no-caffeine'])).toBe(false);
    expect(matchesDiet('mint-margarita', ['vegan', 'no-caffeine', 'no-nuts'])).toBe(true);
    expect(matchesDiet('ceramic-tumbler', ['no-nuts'])).toBe(false);
  });
});

describe('dietBadges', () => {
  it('puts the diet first, then each allergen', () => {
    expect(dietBadges('margherita-pizza').map((b) => b.text)).toEqual(['VEGETARIAN', 'WHEAT', 'MILK']);
    expect(dietBadges('ceramic-tumbler')).toEqual([]);
  });
});
