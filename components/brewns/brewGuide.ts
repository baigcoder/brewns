/* Brew at home: four ways to make brewns beans at home, with the numbers for
   however many cups and a timer that walks through the pours. Recipes are for
   the beans the shop sells; `beans` and `grind` pick the bag and grind that the
   "buy the beans" button opens. */

export type BrewStep = {
  /** Seconds from the start of the brew. */
  at: number;
  title: string;
  /** {coffee}, {water}, {bloom} and {half} are filled in from the calculator. */
  text: string;
};

export type BrewMethod = {
  id: string;
  name: string;
  short: string;
  blurb: string;
  /** Grams of water per gram of coffee, at the three strengths. */
  ratios: [number, number, number];
  /** Grams of coffee for one cup at the middle strength. */
  dosePerCup: number;
  cups: { min: number; max: number; def: number };
  grind: string;
  temp: string;
  kit: string;
  steps: BrewStep[];
  /** Total time in seconds, the end of the timer. */
  total: number;
  beans: string;
  /** Index of the matching GRIND choice on that bag. */
  grindChoice: number;
  cupLabel: string;
};

export const STRENGTHS = ['LIGHTER', 'BALANCED', 'STRONGER'] as const;

export const BREW_METHODS: BrewMethod[] = [
  {
    id: 'v60',
    name: 'V60 POUR-OVER',
    short: 'V60',
    blurb: 'Clean, bright and a little floral. The cup that shows off a single origin.',
    ratios: [17, 16, 15],
    dosePerCup: 15,
    cups: { min: 1, max: 4, def: 1 },
    grind: 'MEDIUM-FINE · TABLE SALT',
    temp: '94°C · JUST OFF THE BOIL',
    kit: 'V60 DRIPPER · PAPER FILTER · SCALE',
    steps: [
      { at: 0, title: 'BLOOM', text: 'Pour {bloom} g of water, just enough to wet every ground, and swirl. The coffee puffs up as the gas escapes.' },
      { at: 45, title: 'FIRST POUR', text: 'Pour in slow circles from the middle out, up to {half} g on the scale.' },
      { at: 90, title: 'SECOND POUR', text: 'Keep circling, gently, up to {water} g. Keep the water off the paper walls.' },
      { at: 130, title: 'SWIRL', text: 'Give the dripper one swirl so the bed settles flat. Let it draw down.' },
      { at: 180, title: 'ENJOY', text: 'It should finish draining around three minutes. Faster and sour: grind finer. Slower and bitter: coarser.' },
    ],
    total: 180,
    beans: 'single-origin',
    grindChoice: 1,
    cupLabel: 'CUP · 250 ML',
  },
  {
    id: 'french-press',
    name: 'FRENCH PRESS',
    short: 'PRESS',
    blurb: 'Heavy, round and forgiving. Slow Roast at its most chocolatey.',
    ratios: [16, 15, 14],
    dosePerCup: 17,
    cups: { min: 1, max: 4, def: 2 },
    grind: 'COARSE · SEA SALT',
    temp: '95°C · OFF THE BOIL',
    kit: 'FRENCH PRESS · SPOON · SCALE',
    steps: [
      { at: 0, title: 'POUR', text: 'Add all {water} g of water over the {coffee} g of coffee, fast, so every ground is wet.' },
      { at: 30, title: 'STIR', text: 'Stir three times so nothing floats dry, then put the lid on with the plunger up.' },
      { at: 240, title: 'BREAK THE CRUST', text: 'Stir the crust on top and skim off the foam with two spoons.' },
      { at: 270, title: 'PRESS & POUR', text: 'Press slowly, then pour it all out straight away so it stops brewing.' },
      { at: 300, title: 'ENJOY', text: 'Let it cool for a minute. Muddy? Grind coarser or press more gently.' },
    ],
    total: 300,
    beans: 'slow-roast',
    grindChoice: 3,
    cupLabel: 'MUG · 255 ML',
  },
  {
    id: 'aeropress',
    name: 'AEROPRESS',
    short: 'AEROPRESS',
    blurb: 'Quick, sweet and made for travel. Two minutes to a clean, full cup.',
    ratios: [16, 15, 13],
    dosePerCup: 15,
    cups: { min: 1, max: 1, def: 1 },
    grind: 'MEDIUM · FINE SAND',
    temp: '85°C · A MINUTE OFF THE BOIL',
    kit: 'AEROPRESS · PAPER FILTER · SCALE',
    steps: [
      { at: 0, title: 'POUR', text: 'Set it up inverted, add the {coffee} g of coffee, and pour {water} g of water.' },
      { at: 15, title: 'STIR', text: 'Stir back and forth five times, then screw on the rinsed filter cap.' },
      { at: 75, title: 'FLIP', text: 'Flip it onto your cup in one quick move.' },
      { at: 90, title: 'PRESS', text: 'Press down slowly for about thirty seconds, stopping at the hiss.' },
      { at: 120, title: 'ENJOY', text: 'Drink it as it is, or top up with hot water for a longer cup.' },
    ],
    total: 120,
    beans: 'single-origin',
    grindChoice: 1,
    cupLabel: 'CUP · 225 ML',
  },
  {
    id: 'moka',
    name: 'MOKA POT',
    short: 'MOKA',
    blurb: 'Strong, syrupy and on the stove. The closest thing to espresso without a machine.',
    ratios: [8, 7, 6],
    dosePerCup: 10,
    cups: { min: 1, max: 3, def: 2 },
    grind: 'FINE · JUST COARSER THAN ESPRESSO',
    temp: 'HOT WATER IN THE BASE',
    kit: 'MOKA POT · STOVE · TOWEL',
    steps: [
      { at: 0, title: 'FILL', text: 'Fill the base with {water} g of just-boiled water, up to the valve and no higher.' },
      { at: 30, title: 'LEVEL', text: 'Fill the basket with {coffee} g of coffee and level it with a finger. Never tamp.' },
      { at: 60, title: 'HEAT', text: 'Screw it shut with a towel (the base is hot) and set it on medium heat, lid open.' },
      { at: 180, title: 'LISTEN', text: 'When the coffee turns pale and starts to gurgle, take it off the heat.' },
      { at: 200, title: 'ENJOY', text: 'Cool the base under a cold tap to stop it, stir, and pour. Add hot water or milk if you like.' },
    ],
    total: 200,
    beans: 'slow-roast',
    grindChoice: 1,
    cupLabel: 'SHOT · 60 ML',
  },
];

export const methodById = (id: string) => BREW_METHODS.find((m) => m.id === id) ?? BREW_METHODS[0];

/** Coffee and water in grams for this many cups at this strength (0 lighter … 2 stronger). */
export const brewAmounts = (m: BrewMethod, cups: number, strength: number) => {
  const water = Math.round((m.dosePerCup * m.ratios[1] * cups) / 5) * 5;
  const coffee = Math.round((water / m.ratios[strength]) * 2) / 2;
  return { coffee, water, bloom: Math.round(coffee * 2), half: Math.round((water * 0.6) / 5) * 5, ratio: m.ratios[strength] };
};

export const fillStep = (text: string, a: ReturnType<typeof brewAmounts>) =>
  text.replace(/\{(coffee|water|bloom|half)\}/g, (_, k: 'coffee' | 'water' | 'bloom' | 'half') => String(a[k]));

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The step that is running at `t` seconds. */
export const stepAt = (m: BrewMethod, t: number) => {
  let i = 0;
  m.steps.forEach((s, k) => {
    if (t >= s.at) i = k;
  });
  return i;
};
