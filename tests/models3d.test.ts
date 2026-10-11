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

  it('keeps the printed takeaway cups on their modelled cup, not a photo relief', async () => {
    const { viewMode } = await import('@/components/brewns/viewPolicy');
    for (const id of ['espresso', 'latte']) expect(viewMode({ id, model: 'cup' })).toBe('model');
    expect(engine).toMatch(/case 'espresso':[\s\S]*?createPackagingModel\(T, gltf, 'cup'/);
  });

  it('prints the lower body of the latte cup as the visible drink, because the photographed cup is clear', () => {
    expect(engine).toMatch(/liquid\?: \{ top: string; bottom: string; pearls\?: boolean \}/);
    expect(engine).toMatch(/band: '100% COFFEE · NO ARTIFICIAL · ',[\s\S]{0,80}liquid: \{/);
  });

  it('offers 3D VIEW for the nine drinkware products rebuilt against their photographs, and keeps tilt for the rest', async () => {
    const { viewMode } = await import('@/components/brewns/viewPolicy');
    const drinkware = ['mint-margarita', 'peach-iced-tea', 'mango-smoothie', 'lime-soda', 'cortado', 'nitro-cold-brew', 'flat-white', 'mocha', 'ceramic-tumbler'];
    for (const id of drinkware) expect(viewMode({ id, model: 'glass' })).toBe('model');
    // every catalogue product with a viewer now has a verified model; a new product without one falls back to relief
    for (const id of ['future-burger', 'future-roll']) expect(viewMode({ id, model: 'food' })).toBe('relief');
  });

  it('builds the cortado and nitro in a faceted Gibraltar glass, and the tumbler print from the photograph', () => {
    const drink = readFileSync('components/brewns/drinkModels3d.ts', 'utf8');
    expect(drink).toMatch(/function gibraltarShell/);
    expect(drink).toMatch(/gibraltarShell\(T, kit, g\)/g);
    expect(drink).toMatch(/\/assets\/menu\/tumbler-black\.webp/);
  });

  it('puts loose garnish on the floor and in the glass, not floating (lime soda, mango)', () => {
    const glass = readFileSync('components/brewns/glassModels3d.ts', 'utf8');
    expect(glass).toMatch(/function rest\(/);
    expect(glass).toMatch(/rest\(T, wedge, g\.inner\)/);
    expect(glass).toMatch(/rest\(T, mango, g\.inner\)/);
  });

  it('offers 3D VIEW for the pizzas, pastas and bakery rebuilt against their photographs, except the cut-open butter croissant', async () => {
    const { viewMode } = await import('@/components/brewns/viewPolicy');
    const food = ['margherita-pizza', 'pepperoni-pizza', 'fajita-pizza', 'alfredo-pasta', 'arrabbiata-pasta', 'pesto-pasta', 'cardamom-bun', 'cinnamon-roll', 'matcha-financier', 'almond-croissant', 'san-sebastian', 'fudge-brownie', 'tiramisu'];
    for (const id of food) expect(viewMode({ id, model: 'food' })).toBe('model');
    expect(viewMode({ id: 'butter-croissant', model: 'bakery' })).toBe('model');
  });

  it('builds the margherita from layered geometry: puffed crust, sauce, torn cheese and folded basil leaves', () => {
    const k = readFileSync('components/brewns/kitchenModels3d.ts', 'utf8');
    expect(k).toMatch(/basilGeo\(T, kit/);
    expect(k).toMatch(/blob\(T, kit, rx \* 1\.1, 0\.034, rz \* 1\.1/);
    expect(k).toMatch(/viewPitch = 0\.95/);
  });

  it('offers 3D VIEW for the burgers, rolls, sides and the cut-open croissant, and builds the croissant cut from honeycomb', async () => {
    const { viewMode } = await import('@/components/brewns/viewPolicy');
    for (const id of ['smash-burger', 'zinger-burger', 'bbq-burger', 'tikka-roll', 'behari-roll', 'crispy-wrap', 'truffle-fries', 'chicken-tenders', 'garlic-bread', 'butter-croissant']) expect(viewMode({ id, model: 'food' })).toBe('model');
    const bakery = readFileSync('components/brewns/bakeryModels3d.ts', 'utf8');
    expect(bakery).toMatch(/croissantCut\(T, kit, T0, -1\)/);
    expect(bakery).toMatch(/const honeycomb = /);
  });

  it('keeps the Ethiopia bag consistent with the catalogue: its notes and copy, no roasting city, no printed roast date', () => {
    const catalog = readFileSync('lib/catalog.ts', 'utf8');
    const entry = catalog.slice(catalog.indexOf('id: "single-origin"'), catalog.indexOf('id: "latte"'));
    const notes = [...entry.match(/notes: \[([^\]]*)\]/)![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(notes).toEqual(['JASMINE', 'BERGAMOT', 'WHITE PEACH']);
    // the label's notes are exactly the catalogue's
    expect(engine).toContain(`notes: [${notes.map((n) => `'${n}'`).join(', ')}],`);
    expect(engine).toMatch(/origin: \{ name: 'ETHIOPIA', sub: 'SINGLE ORIGIN' \}/);
    expect(engine).toMatch(/function drawHighlands/);
    // no roasting city on the Ethiopia bag, and the photograph's Copenhagen and 12/06/24 are not reproduced
    expect(engine).not.toMatch(/COPENHAGEN/);
    expect(engine).not.toMatch(/12\/06\/24'/);
    expect(engine).not.toMatch(/roastDate\(/);
    expect(engine).not.toMatch(/new Date\(/);
    // the label never prints the photograph's conflicting Slow Roast notes under the Ethiopia name
    const eth = engine.slice(engine.indexOf("'single-origin': {"), engine.indexOf('// The latte'));
    expect(eth).not.toMatch(/CARAMEL'/);
  });

  it('keeps the smash options real: + CHEESE and + PATTY both change the model, and the lettuce is a lobed leaf', () => {
    const f = readFileSync('components/brewns/foodModels3d.ts', 'utf8');
    expect(f).toMatch(/extraCheese\.visible = extra === 1/);
    expect(f).toMatch(/extraPatty\.visible = extra === 2/);
    expect(f).toMatch(/const lettuceLeaf = /);
    expect(f).toMatch(/const sauceLobes = /);
  });

  it('gives extra garlic-bread cheese a real melt, not just strings, and a warmed croissant a glossier shell', () => {
    const k = readFileSync('components/brewns/kitchenModels3d.ts', 'utf8');
    const b = readFileSync('components/brewns/bakeryModels3d.ts', 'utf8');
    expect(k).toMatch(/more\.visible = s\.cheese === 1/);
    expect(b).toMatch(/skinMat\.clearcoat = warm/);
  });

  it('labels each viewer for what it is: a model, a limited-angle relief, or just the photograph', async () => {
    const { viewMode } = await import('@/components/brewns/viewPolicy');
    expect(viewMode({ id: 'americano', model: 'cup' })).toBe('model');
    expect(viewMode({ id: 'future-product', model: 'food' })).toBe('relief');
    expect(viewMode({ id: 'single-origin', model: 'bag' })).toBe('model');
    expect(viewMode({ id: 'gift-card' })).toBe('photo');
    expect(site).toMatch(/viewMode\(p\) === "model" \? "3D VIEW" : "TILT VIEW"/);
    expect(site).toMatch(/viewMode\(product\) === "relief" \? `\$\{product\.name\} photograph in relief/);
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
