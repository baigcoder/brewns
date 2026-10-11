/* What goes well with what, for the product page's "Pairs well with" and its
   one-tap "Add both". One suggestion per item, picked by hand: a drink with
   something to eat, a main with its side or a cooler, a bag of beans with the
   thing you brew it in. Ids are the catalog's; a test keeps them honest. */

export const PAIRS: Record<string, string> = {
  /* coffee bar */
  espresso: 'cardamom-bun',
  americano: 'almond-croissant',
  latte: 'butter-croissant',
  'iced-latte': 'butter-croissant',
  cappuccino: 'cardamom-bun',
  'flat-white': 'butter-croissant',
  cortado: 'cinnamon-roll',
  mocha: 'fudge-brownie',
  'spanish-latte': 'cinnamon-roll',
  'iced-matcha': 'matcha-financier',
  'nitro-cold-brew': 'cardamom-bun',

  /* bakery */
  'butter-croissant': 'latte',
  'almond-croissant': 'flat-white',
  'cardamom-bun': 'cappuccino',
  'cinnamon-roll': 'cortado',
  'matcha-financier': 'iced-matcha',
  'san-sebastian': 'espresso',
  'fudge-brownie': 'mocha',
  tiramisu: 'americano',

  /* kitchen */
  'smash-burger': 'truffle-fries',
  'zinger-burger': 'lime-soda',
  'bbq-burger': 'truffle-fries',
  'alfredo-pasta': 'garlic-bread',
  'arrabbiata-pasta': 'garlic-bread',
  'pesto-pasta': 'garlic-bread',
  'tikka-roll': 'lime-soda',
  'behari-roll': 'mint-margarita',
  'crispy-wrap': 'peach-iced-tea',
  'margherita-pizza': 'mint-margarita',
  'fajita-pizza': 'lime-soda',
  'pepperoni-pizza': 'peach-iced-tea',
  'truffle-fries': 'smash-burger',
  'chicken-tenders': 'lime-soda',
  'garlic-bread': 'alfredo-pasta',

  /* coolers */
  'mint-margarita': 'margherita-pizza',
  'peach-iced-tea': 'crispy-wrap',
  'mango-smoothie': 'cardamom-bun',
  'lime-soda': 'zinger-burger',

  /* beans and kit */
  'slow-roast': 'ceramic-tumbler',
  'single-origin': 'ceramic-tumbler',
  'ceramic-tumbler': 'slow-roast',
};

/** The id that pairs with `id`, or undefined (gift cards have none). */
export const pairOf = (id: string): string | undefined => PAIRS[id];
