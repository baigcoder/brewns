import { describe, expect, it } from 'bun:test';
import { CATALOG } from '@/lib/catalog';
import { PAIRS, pairOf } from '@/lib/pairings';

describe('pairings', () => {
  const ids = new Set(CATALOG.map((p) => p.id));

  it('only pairs things that are on the menu', () => {
    for (const [from, to] of Object.entries(PAIRS)) {
      expect([from, ids.has(from)]).toEqual([from, true]);
      expect([to, ids.has(to)]).toEqual([to, true]);
    }
  });

  it('never pairs an item with itself', () => {
    for (const [from, to] of Object.entries(PAIRS)) expect([from, from === to]).toEqual([from, false]);
  });

  it('gives every food, drink and bag of beans a pairing (gift cards have none)', () => {
    const missing = CATALOG.filter((p) => !p.gift && !pairOf(p.id)).map((p) => p.id);
    expect(missing).toEqual([]);
  });
});
