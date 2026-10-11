/* How each product's "3D" tab is honest about what it can show.
   model:  a modelled piece that turns a full 360° and has been checked against the product's photograph.
   relief: the photograph lifted into relief; it tilts a few degrees each way and is labelled as such.
   photo:  no accurate model and nothing worth tilting; the product keeps its photograph and has no 3D tab. */
export type ViewMode = 'model' | 'relief' | 'photo';

/* Checked against each product's photograph by scripts/audit-compare.mjs and audit-matrix.mjs (see
   docs/3d-product-audit.md): the front view, colours, branding and props of these modelled pieces match their photo
   closely enough to be the 3D view. The latte is kept as a model with a known gap (its body is opaque cream, the
   photographed cup is clear). Everything else still has a stylised model that does not look like its photograph
   (burgers, rolls, fries and the rest of the kitchen, and the butter croissant), so it keeps its photograph in relief, or has neither (PHOTO). */
const MODEL = new Set<string>([
  'espresso', 'latte', 'slow-roast', 'iced-matcha', 'iced-latte', 'cappuccino', 'spanish-latte', 'americano',
  // Drinkware rebuilt against its photograph in phase 1 of docs/3d-generation-plan.md; see docs/3d-product-audit.md.
  'mint-margarita', 'peach-iced-tea', 'mango-smoothie', 'lime-soda', 'cortado', 'nitro-cold-brew', 'flat-white', 'mocha', 'ceramic-tumbler',
  // Plated food and bakery rebuilt against their photographs in phase 2.
  'margherita-pizza', 'pepperoni-pizza', 'fajita-pizza', 'alfredo-pasta', 'arrabbiata-pasta', 'pesto-pasta',
  'cardamom-bun', 'cinnamon-roll', 'matcha-financier', 'almond-croissant', 'san-sebastian', 'fudge-brownie', 'tiramisu',
  // Phase 3: burgers, rolls, sides and the cut-open croissant, rebuilt against their photographs.
  'single-origin', 'smash-burger', 'zinger-burger', 'bbq-burger', 'tikka-roll', 'behari-roll', 'crispy-wrap', 'truffle-fries', 'chicken-tenders', 'garlic-bread', 'butter-croissant',
]);
// The Ethiopia bag's photograph has mountain artwork and a "slow roast" title the model does not reproduce, and a bag
// shot on a dark set has no cutout to lift into relief.
const PHOTO = new Set<string>([]);

export function viewMode(p: { id?: string; model?: string } | null): ViewMode {
  if (!p?.id || !p.model) return 'photo';
  // `window.__viewMode` lets scripts/audit-3d.mjs render both treatments of one product.
  const forced = typeof window !== 'undefined' ? (window as { __viewMode?: ViewMode }).__viewMode : undefined;
  if (forced) return forced;
  return MODEL.has(p.id) ? 'model' : PHOTO.has(p.id) ? 'photo' : 'relief';
}
