import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CATALOG } from '@/lib/catalog';
import { fbm, noise3, rng } from '@/components/brewns/foodKit';

const engine = readFileSync('components/brewns/pdp3dEngine.ts', 'utf8');
const site = readFileSync('components/brewns/initBrewns.ts', 'utf8');

/** Products whose 3D view is a purpose-built model rather than the shared cup or bag. */
const BUILT_BY_ID = CATALOG.filter((p) => ['kitchen', 'coolers', 'bakery'].includes(p.cat) || ['spanish-latte', 'americano', 'cappuccino', 'flat-white', 'mocha'].includes(p.id));

describe('3D product models', () => {
  it('routes every kitchen, cooler and bakery product to its own builder', () => {
    const missing = BUILT_BY_ID.filter((p) => !engine.includes(`case '${p.id}':`)).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  it('builds every drink without downloading a cup model', () => {
    // The iced cups, the coolers and the Spanish latte are all built procedurally now.
    for (const p of CATALOG.filter((p) => ['iced-matcha', 'iced-latte', 'spanish-latte'].includes(p.id) || p.cat === 'coolers')) expect(site).not.toContain(`"${p.id}": ICED_CUP_URL`);
    expect(engine).toMatch(/case 'iced-matcha':[\s\S]*?createIcedCupModel/);
  });

  it('shows the hot ceramic drinks in ceramic, not the takeaway cup', () => {
    for (const id of ['americano', 'cappuccino', 'flat-white', 'mocha']) expect(engine).toMatch(new RegExp(`case '${id}':[\\s\\S]*?createCeramicCupModel`));
  });

  it('shows each product with a photo as its photograph in relief, falling back to the model', () => {
    expect(site).toMatch(/createPhotoRelief\(T, photoUrl/);
    expect(site).toMatch(/onError: \(\) => !destroyed && fallBackToModel\(\)/);
  });

  it('turns the 3D tab on for every kitchen product', () => {
    expect(site).toContain('model: "food"');
  });
});

describe('food kit', () => {
  it('makes noise that is stable and in range', () => {
    expect(noise3(1.3, 2.7, 0.4, 5)).toBe(noise3(1.3, 2.7, 0.4, 5));
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.37, i * 0.11, i * 0.05, 4, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('repeats a seeded sequence so a model looks the same every time it opens', () => {
    const a = rng(9), b = rng(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(9)()).not.toBe(rng(10)());
  });
});

describe('photo relief', () => {
  it('keeps overhead shots shallow and side-on products round', async () => {
    const { reliefDepth } = await import('@/components/brewns/photoRelief');
    expect(reliefDepth({ id: 'margherita-pizza', cat: 'kitchen' })).toBeLessThan(reliefDepth({ id: 'americano', cat: 'drinks' }));
    expect(reliefDepth({ id: 'alfredo-pasta', cat: 'kitchen' })).toBeLessThan(reliefDepth({ id: 'iced-latte', cat: 'drinks' }));
  });
});
