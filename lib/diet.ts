/* Diet and allergen facts for the menu, read by the site's filters and product
   pages. Kept beside the catalog (same ids) rather than inside it, so the café
   can correct a recipe in one small table without touching prices or options.

   It follows the recipes on the menu and the FAQ ("our kitchen handles wheat,
   milk, eggs, nuts and sesame"). A warning is listed whenever an ingredient
   plausibly carries it, so the table errs towards over-warning. It is guidance,
   not a medical guarantee: the site always tells people with allergies to speak
   to the barista. Items not listed (merch, gift card) have no diet facts.

   `swap` lists allergens an option on the item removes (oat milk for dairy);
   `veganSwap` says the item becomes fully vegan with that swap. */

export type Allergen = 'gluten' | 'dairy' | 'egg' | 'nuts' | 'sesame';
export type Diet = 'vegan' | 'vegetarian' | 'meat';
export type DietFilter = 'vegetarian' | 'vegan' | 'no-nuts' | 'no-dairy' | 'no-gluten' | 'no-caffeine';

export type DietFacts = {
  diet: Diet;
  allergens: readonly Allergen[];
  swap?: readonly Allergen[];
  veganSwap?: boolean;
  caffeine?: boolean;
  note?: string;
};

export const ALLERGEN_LABEL: Record<Allergen, string> = { gluten: 'WHEAT', dairy: 'MILK', egg: 'EGG', nuts: 'NUTS', sesame: 'SESAME' };

export const DIET_FILTERS: readonly { key: DietFilter; label: string }[] = [
  { key: 'vegetarian', label: 'VEGETARIAN' },
  { key: 'vegan', label: 'VEGAN' },
  { key: 'no-dairy', label: 'NO DAIRY' },
  { key: 'no-gluten', label: 'NO WHEAT' },
  { key: 'no-nuts', label: 'NO NUTS' },
  { key: 'no-caffeine', label: 'CAFFEINE-FREE' },
];

const MILK_DRINK = { diet: 'vegetarian', allergens: ['dairy'], swap: ['dairy'], veganSwap: true, caffeine: true, note: 'Dairy-free with oat or almond milk' } as const satisfies DietFacts;

export const DIET: Record<string, DietFacts> = {
  /* kitchen */
  'smash-burger': { diet: 'meat', allergens: ['gluten', 'dairy', 'egg'] },
  'zinger-burger': { diet: 'meat', allergens: ['gluten', 'dairy', 'egg', 'sesame'] },
  'bbq-burger': { diet: 'meat', allergens: ['gluten', 'dairy'] },
  'alfredo-pasta': { diet: 'meat', allergens: ['gluten', 'dairy'], note: 'Choose mushroom instead of chicken to make it vegetarian' },
  'arrabbiata-pasta': { diet: 'vegetarian', allergens: ['gluten'] },
  'pesto-pasta': { diet: 'meat', allergens: ['gluten', 'dairy', 'nuts'] },
  'tikka-roll': { diet: 'meat', allergens: ['gluten', 'dairy'] },
  'behari-roll': { diet: 'meat', allergens: ['gluten', 'dairy'] },
  'crispy-wrap': { diet: 'meat', allergens: ['gluten', 'egg'] },
  'margherita-pizza': { diet: 'vegetarian', allergens: ['gluten', 'dairy'] },
  'fajita-pizza': { diet: 'meat', allergens: ['gluten', 'dairy'] },
  'pepperoni-pizza': { diet: 'meat', allergens: ['gluten', 'dairy'] },
  'truffle-fries': { diet: 'vegetarian', allergens: ['dairy', 'egg'] },
  'chicken-tenders': { diet: 'meat', allergens: ['gluten', 'dairy', 'egg'] },
  'garlic-bread': { diet: 'vegetarian', allergens: ['gluten', 'dairy'] },

  /* coolers */
  'mint-margarita': { diet: 'vegan', allergens: [] },
  'peach-iced-tea': { diet: 'vegan', allergens: [], caffeine: true },
  'mango-smoothie': { diet: 'vegetarian', allergens: ['dairy'], swap: ['dairy'], note: 'Dairy-free with oat milk. Sweetened with honey.' },
  'lime-soda': { diet: 'vegan', allergens: [] },

  /* beans */
  'slow-roast': { diet: 'vegan', allergens: [], caffeine: true },
  'single-origin': { diet: 'vegan', allergens: [], caffeine: true },

  /* coffee bar */
  espresso: { diet: 'vegan', allergens: [], caffeine: true },
  americano: { diet: 'vegan', allergens: [], caffeine: true },
  'nitro-cold-brew': { diet: 'vegan', allergens: [], caffeine: true },
  latte: MILK_DRINK,
  'iced-latte': MILK_DRINK,
  cappuccino: MILK_DRINK,
  'flat-white': MILK_DRINK,
  cortado: MILK_DRINK,
  mocha: MILK_DRINK,
  'iced-matcha': MILK_DRINK,
  'spanish-latte': { diet: 'vegetarian', allergens: ['dairy'], caffeine: true, note: 'Made with condensed milk, so no dairy-free swap' },

  /* bakery. The financier is made without wheat flour (see the FAQ). */
  'cardamom-bun': { diet: 'vegetarian', allergens: ['gluten', 'dairy', 'egg'] },
  'cinnamon-roll': { diet: 'vegetarian', allergens: ['gluten', 'dairy', 'egg'] },
  'matcha-financier': { diet: 'vegetarian', allergens: ['dairy', 'egg', 'nuts'], caffeine: true, note: 'Made without wheat flour; contains almond' },
  'butter-croissant': { diet: 'vegetarian', allergens: ['gluten', 'dairy', 'egg'] },
  'almond-croissant': { diet: 'vegetarian', allergens: ['gluten', 'dairy', 'egg', 'nuts'] },
  'san-sebastian': { diet: 'vegetarian', allergens: ['dairy', 'egg'] },
  'fudge-brownie': { diet: 'vegetarian', allergens: ['gluten', 'dairy', 'egg'] },
  tiramisu: { diet: 'vegetarian', allergens: ['gluten', 'dairy', 'egg'], caffeine: true },
};

export const dietOf = (id: string): DietFacts | undefined => DIET[id];

/** Whether an item suits every active filter. Items with no diet facts never match. */
export function matchesDiet(id: string, active: readonly DietFilter[]): boolean {
  if (!active.length) return true;
  const d = DIET[id];
  if (!d) return false;
  const free = (a: Allergen) => !d.allergens.includes(a) || !!d.swap?.includes(a);
  return active.every((f) => {
    switch (f) {
      case 'vegetarian':
        return d.diet !== 'meat';
      case 'vegan':
        return d.diet === 'vegan' || (!!d.veganSwap && d.diet === 'vegetarian');
      case 'no-dairy':
        return free('dairy');
      case 'no-gluten':
        return free('gluten');
      case 'no-nuts':
        return free('nuts');
      case 'no-caffeine':
        return !d.caffeine;
    }
  });
}

/** Short badges for a card: diet first, then what it contains. */
export function dietBadges(id: string): { text: string; kind: 'diet' | 'allergen' }[] {
  const d = DIET[id];
  if (!d) return [];
  const out: { text: string; kind: 'diet' | 'allergen' }[] = [];
  if (d.diet === 'vegan') out.push({ text: 'VEGAN', kind: 'diet' });
  else if (d.diet === 'vegetarian') out.push({ text: d.veganSwap ? 'VEGAN WITH OAT' : 'VEGETARIAN', kind: 'diet' });
  for (const a of d.allergens) out.push({ text: ALLERGEN_LABEL[a], kind: 'allergen' });
  return out;
}
