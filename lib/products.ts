/* The catalogue as pages: every product gets /shop/<id>, grouped the way the
   café thinks about them, with the picture the site already shows for it. */

import { CATALOG, catalogItem, type Product } from './catalog';
import { pairOf } from './pairings';

export type Group = { key: string; label: string; blurb: string; cats: string[] };

export const GROUPS: Group[] = [
  { key: 'beans', label: 'Coffee beans', blurb: 'Roasted every week in Lahore, the roast date on every bag.', cats: ['beans'] },
  { key: 'coffee', label: 'Coffee & drinks', blurb: 'Pulled at 92°C for 27 seconds, at every counter.', cats: ['drinks'] },
  { key: 'coolers', label: 'Coolers', blurb: 'Cold, bright and made to order.', cats: ['coolers'] },
  { key: 'bakery', label: 'Bakery', blurb: 'Baked fresh for the counter every morning.', cats: ['bakery'] },
  { key: 'kitchen', label: 'Kitchen', blurb: 'Smash burgers, wood-fired pizza, pasta and paratha rolls.', cats: ['kitchen'] },
  { key: 'merch', label: 'Merch', blurb: 'For the coffee you take with you.', cats: ['merch'] },
  { key: 'gifts', label: 'Gift cards', blurb: 'Good coffee for someone else’s day.', cats: ['gifts'] },
];

export const groupOf = (p: Pick<Product, 'cat'>) => GROUPS.find((g) => g.cats.includes(p.cat)) ?? GROUPS[1];
export const productsIn = (g: Group) => CATALOG.filter((p) => g.cats.includes(p.cat));
export const shopProducts = () => CATALOG;

/** The picture for a product: its own photo, or the kitchen's photo of the dish. */
export const productImage = (p: Product) => (p.photo ? `/assets/${p.photo}` : p.cat === 'kitchen' || p.cat === 'coolers' ? `/assets/kitchen/${p.id}.webp` : null);

/** Lowest price, for "from Rs …". */
export const fromPrice = (p: Product) => p.price + Math.min(0, ...p.options.flatMap((o) => o.choices.map((c) => c[1])));

/** A few others to look at: the pairing first, then the rest of the same group. */
export function related(p: Product, n = 4): Product[] {
  const pair = pairOf(p.id);
  const first = pair ? catalogItem(pair) : undefined;
  const same = productsIn(groupOf(p)).filter((x) => x.id !== p.id && x.id !== first?.id);
  return [first, ...same].filter((x): x is Product => !!x && !x.gift).slice(0, n);
}

export const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sp, ch) => sp + ch.toUpperCase());
