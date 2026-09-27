/* The menu and the shop, their prices, and the rules a bill is worked out by.

   One list, read by the site (initBrewns.ts adds pictures, 3D models and the
   drawn dishes) and by the server, which prices every order again from these
   numbers rather than trusting the total a browser sends. Prices are whole
   rupees; option choices are [label, price change, note]; `def` is the choice
   selected to begin with. */

export type Choice = readonly [label: string, delta: number, note?: string];
export type Option = { key: string; label: string; choices: readonly Choice[]; def?: number; wrap?: boolean; plain?: boolean };
export type Sel = Record<string, number>;

export type Product = {
  id: string;
  name: string;
  cat: string;
  price: number;
  options: readonly Option[];
  tag?: string;
  model?: string;
  feature?: boolean;
  gift?: boolean;
  photo?: string;
  /** The photo is a cut-out with no background: it stands on the dark card, like the rendered bags. */
  cutout?: boolean;
  alt?: string;
  meta?: string;
  notes?: readonly string[];
  desc?: string;
  details?: readonly (readonly [string, string])[];
  care?: string;
};

export type KitchenDish = Omit<Product, 'cat'> & { menuCat: string; art: readonly [string, string] };

/* ── the kitchen: burgers, pasta, rolls, pizza, coolers ── */

export const MEAL: Option = { key: "meal", label: "MAKE IT A MEAL", choices: [["JUST THE BURGER", 0], ["+ FRIES & DRINK", 450]] };
export const SPICE: Option = { key: "spice", label: "SPICE", def: 1, choices: [["MILD", 0], ["MEDIUM", 0], ["HOT", 0]] };
export const PIZZA_SIZE: Option = { key: "size", label: "SIZE", def: 1, choices: [['8"', -600], ['10"', 0], ['12"', 700]] };
export const COOLER_SIZE: Option = { key: "size", label: "SIZE", choices: [["REGULAR", 0], ["LARGE", 150]] };
export const KITCHEN_BASE: KitchenDish[] = [
  { id: "smash-burger", name: "CLASSIC SMASH BURGER", menuCat: "burgers", art: ["burger", "smash"], tag: "HOUSE FAVOURITE", price: 1350,
    meta: "DOUBLE SMASHED BEEF · CHEDDAR · HOUSE SAUCE", notes: ["JUICY", "CRISPY EDGES"],
    desc: "Two beef patties smashed thin on a hot griddle so the edges crisp, melted cheddar, pickles and our house sauce in a toasted brioche bun.",
    options: [MEAL, { key: "extra", label: "EXTRA", choices: [["NONE", 0], ["+ CHEESE", 150], ["+ PATTY", 400]] }],
    details: [["PATTY", "2 × 90 G BEEF"], ["BUN", "BRIOCHE"], ["SERVED", "WITH A PICKLE"]] },
  { id: "zinger-burger", name: "CRISPY ZINGER BURGER", menuCat: "burgers", art: ["burger", "zinger"], price: 1150,
    meta: "BUTTERMILK FRIED CHICKEN · SLAW · MAYO", notes: ["CRUNCHY", "SPICY"],
    desc: "A thick fillet brined in buttermilk, fried to a loud crunch, with crisp lettuce, garlic mayo and a little heat.",
    options: [MEAL, SPICE], details: [["FILLET", "CHICKEN THIGH"], ["COATING", "DOUBLE-DIPPED"], ["BUN", "SESAME"]] },
  { id: "bbq-burger", name: "SMOKY BBQ BEEF BURGER", menuCat: "burgers", art: ["burger", "bbq"], price: 1550,
    meta: "BEEF · ONION RINGS · SMOKED BBQ", notes: ["SMOKY", "STICKY"],
    desc: "A thick beef patty glazed in smoked barbecue sauce, stacked with crisp onion rings and cheddar.",
    options: [MEAL], details: [["PATTY", "180 G BEEF"], ["SAUCE", "HICKORY BBQ"], ["BUN", "BRIOCHE"]] },
  { id: "alfredo-pasta", name: "CHICKEN ALFREDO FETTUCCINE", menuCat: "pasta", art: ["pasta", "alfredo"], price: 1450,
    meta: "CREAM · PARMESAN · GRILLED CHICKEN", notes: ["CREAMY", "COMFORT"],
    desc: "Fettuccine in a parmesan cream sauce with grilled chicken, black pepper and parsley.",
    options: [{ key: "protein", label: "PROTEIN", choices: [["CHICKEN", 0], ["MUSHROOM", -150], ["PRAWN", 450]] }],
    details: [["PASTA", "FETTUCCINE"], ["SAUCE", "PARMESAN CREAM"], ["SERVES", "ONE, GENEROUSLY"]] },
  { id: "arrabbiata-pasta", name: "PENNE ARRABBIATA", menuCat: "pasta", art: ["pasta", "arrabbiata"], price: 1250,
    meta: "TOMATO · GARLIC · CHILLI · BASIL", notes: ["FIERY", "VEGETARIAN"],
    desc: "Penne in slow-cooked tomato with garlic and red chilli, finished with basil and olive oil.",
    options: [SPICE, { key: "add", label: "ADD", choices: [["NOTHING", 0], ["+ CHICKEN", 300]] }],
    details: [["PASTA", "PENNE RIGATE"], ["SAUCE", "TOMATO & CHILLI"], ["DIET", "VEGETARIAN"]] },
  { id: "pesto-pasta", name: "PESTO CHICKEN FUSILLI", menuCat: "pasta", art: ["pasta", "pesto"], tag: "NEW", price: 1550,
    meta: "BASIL PESTO · CHICKEN · PARMESAN", notes: ["FRESH", "HERBY"],
    desc: "Fusilli tossed in basil pesto with grilled chicken, cherry tomatoes and shaved parmesan.",
    options: [{ key: "protein", label: "PROTEIN", choices: [["CHICKEN", 0], ["NONE", -250]] }],
    details: [["PASTA", "FUSILLI"], ["PESTO", "BASIL & PINE NUT"], ["TOP", "PARMESAN"]] },
  { id: "tikka-roll", name: "CHICKEN TIKKA PARATHA ROLL", menuCat: "rolls", art: ["roll", "tikka"], tag: "LAHORE CLASSIC", price: 650,
    meta: "CHARGRILLED TIKKA · MINT CHUTNEY · ONION", notes: ["SMOKY", "CHUTNEY"],
    desc: "Chargrilled chicken tikka, pickled onion and mint chutney, rolled in a flaky paratha straight off the tawa.",
    options: [SPICE, { key: "cheese", label: "CHEESE", choices: [["NO", 0], ["YES", 120]] }],
    details: [["WRAP", "LACHHA PARATHA"], ["FILLING", "CHICKEN TIKKA"], ["CHUTNEY", "MINT & YOGURT"]] },
  { id: "behari-roll", name: "BEHARI KEBAB ROLL", menuCat: "rolls", art: ["roll", "behari"], price: 700,
    meta: "TENDER BEEF BEHARI · ONION · IMLI", notes: ["MELT-IN-MOUTH", "SPICED"],
    desc: "Thin-sliced beef marinated overnight in papaya and spices, grilled soft, with onion and tamarind chutney in a paratha.",
    options: [SPICE], details: [["MEAT", "BEEF, OVERNIGHT MARINADE"], ["WRAP", "PARATHA"], ["CHUTNEY", "IMLI"]] },
  { id: "crispy-wrap", name: "CRISPY CHICKEN WRAP", menuCat: "rolls", art: ["roll", "crispy"], price: 850,
    meta: "FRIED CHICKEN · LETTUCE · GARLIC MAYO", notes: ["CRUNCHY", "LIGHT"],
    desc: "Crispy chicken strips, lettuce, tomato and garlic mayo in a toasted flour tortilla.",
    options: [SPICE], details: [["WRAP", "FLOUR TORTILLA"], ["FILLING", "CRISPY STRIPS"], ["SAUCE", "GARLIC MAYO"]] },
  { id: "margherita-pizza", name: "MARGHERITA PIZZA", menuCat: "pizza", art: ["pizza", "margherita"], price: 1650,
    meta: "TOMATO · FIOR DI LATTE · BASIL", notes: ["CLASSIC", "VEGETARIAN"],
    desc: "Hand-stretched dough, San Marzano-style tomato, fresh mozzarella and basil, baked hot until the crust blisters.",
    options: [PIZZA_SIZE], details: [["DOUGH", "48-HOUR PROOF"], ["CHEESE", "FRESH MOZZARELLA"], ["DIET", "VEGETARIAN"]] },
  { id: "fajita-pizza", name: "CHICKEN FAJITA PIZZA", menuCat: "pizza", art: ["pizza", "fajita"], tag: "BESTSELLER", price: 1850,
    meta: "FAJITA CHICKEN · PEPPERS · ONION", notes: ["SPICED", "LOADED"],
    desc: "Fajita-spiced chicken, green and red peppers and onion over mozzarella, the way Lahore likes it.",
    options: [PIZZA_SIZE, { key: "crust", label: "CRUST", choices: [["CLASSIC", 0], ["CHEESE-STUFFED", 350]] }],
    details: [["DOUGH", "48-HOUR PROOF"], ["TOPPING", "FAJITA CHICKEN"], ["CHEESE", "MOZZARELLA"]] },
  { id: "pepperoni-pizza", name: "BEEF PEPPERONI PIZZA", menuCat: "pizza", art: ["pizza", "pepperoni"], price: 1950,
    meta: "BEEF PEPPERONI · MOZZARELLA · OREGANO", notes: ["CRISPY CUPS", "SAVOURY"],
    desc: "Halal beef pepperoni that curls and crisps in the oven, over tomato and plenty of mozzarella.",
    options: [PIZZA_SIZE, { key: "crust", label: "CRUST", choices: [["CLASSIC", 0], ["CHEESE-STUFFED", 350]] }],
    details: [["PEPPERONI", "HALAL BEEF"], ["DOUGH", "48-HOUR PROOF"], ["FINISH", "OREGANO"]] },
  { id: "mint-margarita", name: "MINT MARGARITA", menuCat: "drinks", art: ["drink", "mint"], tag: "SUMMER", price: 550,
    meta: "MINT · LIME · CRUSHED ICE", notes: ["COOLING", "ZESTY"],
    desc: "Fresh mint and lime blended with crushed ice and a pinch of chaat masala. Alcohol-free, like everything we pour.",
    options: [COOLER_SIZE], details: [["BASE", "FRESH MINT & LIME"], ["ICE", "CRUSHED"], ["FINISH", "CHAAT MASALA"]] },
  { id: "peach-iced-tea", name: "PEACH ICED TEA", menuCat: "drinks", art: ["drink", "peach"], price: 600,
    meta: "BLACK TEA · PEACH · LEMON", notes: ["LIGHT", "FRUITY"],
    desc: "Black tea brewed strong, chilled, with peach and a squeeze of lemon.",
    options: [COOLER_SIZE, { key: "sweet", label: "SWEETNESS", def: 1, choices: [["LESS", 0], ["REGULAR", 0], ["EXTRA", 0]] }],
    details: [["TEA", "BLACK, COLD-STEEPED"], ["FRUIT", "PEACH"], ["SERVED", "OVER ICE"]] },
  { id: "mango-smoothie", name: "MANGO SMOOTHIE", menuCat: "drinks", art: ["drink", "mango"], price: 750,
    meta: "CHAUNSA MANGO · YOGURT · HONEY", notes: ["THICK", "SEASONAL"],
    desc: "Ripe mango blended with yogurt and a little honey. Chaunsa in season.",
    options: [COOLER_SIZE, { key: "milk", label: "BASE", choices: [["YOGURT", 0], ["OAT MILK", 150]] }],
    details: [["FRUIT", "MANGO"], ["BASE", "YOGURT"], ["SWEETENER", "HONEY"]] },
  { id: "lime-soda", name: "FRESH LIME SODA", menuCat: "drinks", art: ["drink", "lime"], price: 450,
    meta: "LIME · SODA · SWEET OR SALTED", notes: ["FIZZY", "REFRESHING"],
    desc: "Fresh lime over soda, sweet, salted or half-and-half, the way it's done across Lahore.",
    options: [{ key: "style", label: "STYLE", choices: [["SWEET", 0], ["SALTED", 0], ["MIXED", 0]] }],
    details: [["LIME", "FRESH-SQUEEZED"], ["SODA", "CHILLED"], ["STYLE", "YOUR CALL"]] },
];

/* ── coffee, beans, bakery, merch, gifts ── */

export const MILK: Option = { key: "milk", label: "MILK", choices: [["WHOLE", 0], ["OAT", 150], ["ALMOND", 150]] };
export const PRODUCTS_BASE: Product[] = [
  {
    id: "slow-roast", name: "SLOW ROAST", cat: "beans", tag: "BESTSELLER", price: 3800, photo: "menu/bag-slow-roast.webp", cutout: true, model: "bag", feature: true,
    alt: "A brewns Slow Roast bag in charcoal and sage green",
    meta: "250 G · WHOLE BEAN · COPENHAGEN", notes: ["CARAMEL", "BROWN SUGAR", "ROASTED ALMOND"],
    desc: "Our house roast, taken slow and a shade past medium so the sugars caramelise without tipping into bitter. Sweet in milk, round and clean on its own.",
    options: [
      { key: "size", label: "SIZE", choices: [["250 G", 0], ["500 G", 3000], ["1 KG", 8700]] },
      { key: "grind", label: "GRIND", wrap: true, choices: [["WHOLE BEAN", 0], ["ESPRESSO", 0], ["FILTER", 0], ["FRENCH PRESS", 0]] },
      { key: "plan", label: "PURCHASE", choices: [["ONE-TIME", 0], ["EVERY 2 WK", 0, "SAVE 10%"], ["EVERY 4 WK", 0, "SAVE 10%"]] },
    ],
    details: [["ORIGIN", "COLOMBIA · ETHIOPIA"], ["PROCESS", "WASHED"], ["ROAST", "MEDIUM"], ["ROASTED IN", "COPENHAGEN"]],
    care: "Roasted weekly in small batches and packed in a valved bag. Best within four weeks of the roast date printed on the back. Keep sealed, away from light and heat.",
  },
  {
    id: "single-origin", name: "ETHIOPIA YIRGACHEFFE", cat: "beans", tag: "SINGLE ORIGIN", price: 4800, photo: "menu/bag-yirgacheffe.webp", cutout: true, model: "bag",
    alt: "A brewns Ethiopia single origin bag with an orange mountain landscape",
    meta: "250 G · WASHED HEIRLOOM · 2100M", notes: ["JASMINE", "BERGAMOT", "WHITE PEACH"],
    desc: "Washed heirloom varieties from high-altitude smallholders in Yirgacheffe. A delicate, tea-like body with sparkling citrus acidity, jasmine florals and a sweet peach finish.",
    options: [
      { key: "size", label: "SIZE", choices: [["250 G", 0], ["500 G", 3600], ["1 KG", 10400]] },
      { key: "grind", label: "GRIND", wrap: true, choices: [["WHOLE BEAN", 0], ["FILTER", 0], ["ESPRESSO", 0], ["FRENCH PRESS", 0]] },
      { key: "plan", label: "PURCHASE", choices: [["ONE-TIME", 0], ["EVERY 2 WK", 0, "SAVE 10%"], ["EVERY 4 WK", 0, "SAVE 10%"]] },
    ],
    details: [["ORIGIN", "YIRGACHEFFE · ETHIOPIA"], ["PROCESS", "FULLY WASHED"], ["ELEVATION", "2,100 M"], ["ROAST", "LIGHT-MEDIUM"]],
    care: "Roasted weekly in small batches. Best within five weeks of roast date. Brew with 93°C water for optimal clarity.",
  },
  {
    id: "latte", name: "LATTE", cat: "drinks", price: 950, photo: "menu/cup-latte.webp", model: "cup", alt: "A brewns latte in a clear cup with a navy brewns sleeve",
    meta: "12 OZ · BREWED DAILY · TO GO", notes: ["SMOOTH", "BALANCED"],
    desc: "A double shot of Slow Roast under steamed milk, with a heart poured on top before the lid goes on. The one most of the city starts its morning with.",
    options: [
      { key: "size", label: "SIZE", def: 1, choices: [["8 OZ", -150], ["12 OZ", 0], ["16 OZ", 200]] },
      MILK,
      { key: "temp", label: "TEMPERATURE", choices: [["HOT", 0], ["ICED", 100]] },
    ],
    details: [["ESPRESSO", "DOUBLE · SLOW ROAST"], ["MILK", "STEAMED"], ["CUP", "COMPOSTABLE"]],
    care: "Poured to order when you arrive, so it is never sitting on the counter. Lids are plant-based and the sleeve is recycled paper.",
  },
  {
    id: "espresso", name: "ESPRESSO", cat: "drinks", price: 650, photo: "menu/cup-espresso.webp", model: "cup", alt: "A brewns espresso in a black and orange brewns cup",
    meta: "SINGLE SHOT · SHORT · STRONG", notes: ["DARK CHOCOLATE", "CARAMEL"],
    desc: "Short, strong and on demand. Eighteen grams in, a little under forty out, in about twenty-eight seconds.",
    options: [
      { key: "shots", label: "SHOTS", choices: [["SINGLE", 0], ["DOUBLE", 200]] },
      { key: "style", label: "STYLE", choices: [["STRAIGHT", 0], ["MACCHIATO", 100], ["CORTADO", 250]] },
    ],
    details: [["DOSE", "18 G"], ["YIELD", "38 G"], ["TIME", "28 SEC"]],
    care: "Pulled on a dialled-in grinder every morning, so the first shot of the day tastes like the last.",
  },
  {
    id: "cortado", name: "CORTADO", cat: "drinks", tag: "BARISTA PICK", price: 850, photo: "menu/menu-cortado.webp", model: "glass", alt: "A brewns cortado in a faceted glass with steamed microfoam",
    meta: "4.5 OZ · EQUAL PARTS ESPRESSO & MILK", notes: ["VELVETY", "HAZELNUT"],
    desc: "Equal parts Slow Roast espresso and warm textured milk in a heavy Gibraltar glass. Cuts the intensity while preserving the deep caramel sweetness of the beans.",
    options: [
      { key: "shots", label: "SHOTS", choices: [["DOUBLE", 0], ["TRIPLE", 200]] },
      MILK,
      { key: "temp", label: "TEMPERATURE", choices: [["WARM (57°C)", 0], ["HOT", 0]] },
    ],
    details: [["RATIO", "1:1 ESPRESSO TO MILK"], ["GLASS", "4.5 OZ GIBRALTAR"], ["ORIGIN", "SLOW ROAST BLEND"]],
    care: "Poured immediately upon arrival so the microfoam remains dense and velvety.",
  },
  {
    id: "nitro-cold-brew", name: "NITRO COLD BREW", cat: "drinks", tag: "ON TAP", price: 1100, photo: "menu/menu-cold-brew.webp", model: "glass", alt: "A nitro cold brew coffee in a chilled glass with creamy cascading head",
    meta: "STEEPED 20 HRS · NITROGEN INFUSED", notes: ["STOUT-LIKE", "CREAMY CACAO"],
    desc: "Slow steeped for twenty hours and charged with pure food-grade nitrogen on draft. Pours with a thick cascading head like a fine dry stout, naturally sweet with zero added sugar.",
    options: [
      { key: "size", label: "SIZE", choices: [["12 OZ", 0], ["16 OZ", 200]] },
      { key: "style", label: "POUR", choices: [["STRAIGHT NITRO", 0], ["VANILLA SWEET CREAM", 150]] },
    ],
    details: [["STEEP TIME", "20 HOURS COLD"], ["INFUSION", "PURE NITROGEN"], ["CALORIES", "5 KCAL (BLACK)"]],
    care: "Served cold on draft without ice to maintain the smooth cascading nitrogen head.",
  },
  {
    id: "iced-matcha", name: "ICED MATCHA", cat: "drinks", tag: "NEW", price: 1150, photo: "menu/cup-iced-matcha.webp", model: "glass", alt: "A brewns iced matcha in a clear cup with a green leaf label and a black straw",
    meta: "CEREMONIAL GRADE · OVER ICE", notes: ["GRASSY", "CREAMY"],
    desc: "Ceremonial-grade matcha whisked to order and poured over cold milk and ice, marbled on the way down.",
    options: [
      { key: "size", label: "SIZE", choices: [["12 OZ", 0], ["16 OZ", 200]] },
      MILK,
      { key: "sweet", label: "SWEETNESS", choices: [["NONE", 0], ["LIGHT", 0], ["REGULAR", 0]], def: 1 },
    ],
    details: [["MATCHA", "UJI · CEREMONIAL"], ["SERVED", "OVER ICE"], ["CAFFEINE", "≈ 70 MG"]],
    care: "Whisked by hand, never from a powder mix. Give it a stir with the straw before the first sip.",
  },
  {
    id: "iced-latte", name: "ICED LATTE", cat: "drinks", price: 1050, photo: "menu/cup-iced-latte.webp", model: "glass", alt: "A brewns iced latte in a clear cup with a caramel leaf label and a black straw",
    meta: "DOUBLE SHOT · COLD MILK", notes: ["BOLD", "SMOOTH"],
    desc: "Two shots over ice, topped with cold milk and left to swirl. Smooth, bold and made for the walk between blocks.",
    options: [{ key: "size", label: "SIZE", choices: [["12 OZ", 0], ["16 OZ", 200]] }, MILK, { key: "shots", label: "SHOTS", choices: [["DOUBLE", 0], ["TRIPLE", 200]] }],
    details: [["ESPRESSO", "DOUBLE · SLOW ROAST"], ["SERVED", "OVER ICE"], ["CUP", "RECYCLABLE PET"]],
    care: "Shots are pulled when you arrive and chilled over ice straight away, so it never waters down on the counter.",
  },
  {
    id: "cardamom-bun", name: "CARDAMOM BUN", cat: "bakery", tag: "NORDIC RITUAL", price: 750, photo: "menu/menu-cardamom.webp", model: "bakery", alt: "A freshly baked Swedish cardamom bun with pearl sugar",
    meta: "STONEGROUND CARDAMOM · BROWN SUGAR", notes: ["AROMATIC", "BUTTERY"],
    desc: "Traditional twisted bun enriched with fresh stoneground green cardamom, brown sugar syrup and crunchy Swedish pearl sugar. Baked fresh every morning.",
    options: [
      { key: "serve", label: "SERVE", choices: [["AS IT IS", 0], ["WARMED", 0]] },
    ],
    details: [["BAKED", "DAILY AT 06:30"], ["SPICE", "GUATEMALAN CARDAMOM"], ["WEIGHT", "135 G"]],
    care: "Baked fresh daily. Delicious straight or lightly warmed at the counter.",
  },
  {
    id: "cinnamon-roll", name: "CINNAMON ROLL", cat: "bakery", price: 700, photo: "menu/menu-cinnamon.webp", model: "bakery", alt: "A glazed cinnamon roll on a ceramic plate",
    meta: "BAKED EVERY MORNING", notes: ["BROWN BUTTER", "CARDAMOM"],
    desc: "Laminated dough rolled with brown butter, cinnamon and a little cardamom, finished with a vanilla glaze while it is still warm.",
    options: [
      { key: "warm", label: "SERVE", choices: [["AS IT IS", 0], ["WARMED", 0]] },
      { key: "glaze", label: "GLAZE", choices: [["REGULAR", 0], ["EXTRA", 100]] },
    ],
    details: [["BAKED", "DAILY FROM 06:00"], ["CONTAINS", "WHEAT · MILK · EGG"], ["WEIGHT", "140 G"]],
    care: "Baked in the morning and gone by the afternoon. Order ahead to hold one.",
  },
  {
    id: "matcha-financier", name: "MATCHA FINANCIER", cat: "bakery", tag: "GLUTEN-FREE", price: 650, photo: "menu/menu-financier.webp", model: "bakery", alt: "A golden-green matcha financier cake with dusted icing sugar",
    meta: "ALMOND FLOUR · UJI MATCHA", notes: ["NUTTY", "EARTHY SWEET"],
    desc: "Dense French almond cake infused with ceremonial Uji matcha and browned noisette butter. Crispy edges and a soft, melt-in-the-mouth center.",
    options: [
      { key: "serve", label: "SERVE", choices: [["ROOM TEMP", 0], ["WARMED", 0]] },
    ],
    details: [["ALMOND", "100% VALENCIA"], ["MATCHA", "UJI FIRST HARVEST"], ["WEIGHT", "90 G"]],
    care: "Naturally gluten-free with California almond meal.",
  },
  {
    id: "ceramic-tumbler", name: "CERAMIC TRAVEL TUMBLER", cat: "merch", tag: "ESSENTIAL", price: 6500, photo: "menu/tumbler-black.webp", model: "cup", alt: "A matte ceramic travel tumbler with spill-resistant lid",
    meta: "12 OZ · CERAMIC LINED · DOUBLE WALL", notes: ["TRUE TASTE", "6 HR HEAT RETENTION"],
    desc: "Double-wall vacuum-insulated stainless steel tumbler with an internal ceramic coating so your coffee tastes true to the cup. Fits standard car cup holders and keeps drinks hot for 6 hours.",
    options: [
      { key: "color", label: "COLORWAY", choices: [["MATTE CHARCOAL", 0], ["RAW OAT", 0], ["AMBER CREMA", 0]] },
      { key: "lid", label: "LID TYPE", choices: [["SLIDE LOCK", 0], ["360° SIP LID", 800]] },
    ],
    details: [["CAPACITY", "12 OZ (355 ML)"], ["LINING", "PURE CERAMIC COATING"], ["INSULATION", "DOUBLE-WALL VACUUM"]],
    care: "Hand wash recommended for finish longevity. Dishwasher safe lid.",
  },
  {
    id: "gift-card", name: "GIFT CARD", cat: "gifts", price: 2500, gift: true,
    meta: "DIGITAL · NEVER EXPIRES", notes: ["ALL LOCATIONS", "SENT BY EMAIL"],
    desc: "Good coffee for someone else's day. Redeemable for anything at all three counters, with a note from you on the front.",
    options: [{ key: "amount", label: "AMOUNT", plain: true, choices: [["Rs 2,500", 0], ["Rs 5,000", 2500], ["Rs 10,000", 7500]] }],
    details: [["DELIVERY", "EMAIL · INSTANT"], ["VALID", "ALL LOCATIONS"], ["EXPIRES", "NEVER"]],
    care: "Balances carry over between visits and never expire. Lost the email? Any barista can look it up by name.",
  },
];

/* ── what a line costs ── */

/** Which category a kitchen dish is sold under in the shop. */
export const kitchenCat = (k: Pick<KitchenDish, 'menuCat'>) => (k.menuCat === 'drinks' ? 'coolers' : 'kitchen');

/** Everything that can be ordered, without the pictures the site adds. */
export const CATALOG: Product[] = [...PRODUCTS_BASE, ...KITCHEN_BASE.map(({ menuCat, art: _art, ...k }) => ({ ...k, cat: kitchenCat({ menuCat }) }))];
const BY_ID = new Map(CATALOG.map((p) => [p.id, p]));
export const catalogItem = (id: string) => BY_ID.get(id);

type Priced = Pick<Product, 'price' | 'options'>;
export const defaultSel = (p: Pick<Product, 'options'>): Sel => Object.fromEntries(p.options.map((o) => [o.key, o.def ?? 0]));
/** A bean subscription (every 2 or 4 weeks) is 10% off. */
export const isSub = (p: Pick<Product, 'options'>, sel: Sel) => p.options.some((o) => o.key === 'plan') && sel.plan > 0;
export const basePrice = (p: Priced, sel: Sel) => p.options.reduce((sum, o) => sum + (o.choices[sel[o.key]]?.[1] || 0), p.price);
export const unitPrice = (p: Priced, sel: Sel) => basePrice(p, sel) * (isSub(p, sel) ? 0.9 : 1);
export const selLabel = (p: Pick<Product, 'options'>, sel: Sel) =>
  p.options
    .map((o) => o.choices[sel[o.key]]?.[0])
    .filter(Boolean)
    .join(' · ');
/** A selection the product actually offers: every option set, every index in range. */
export const validSel = (p: Pick<Product, 'options'>, sel: unknown): sel is Sel =>
  !!sel &&
  typeof sel === 'object' &&
  p.options.every((o) => {
    const v = (sel as Sel)[o.key];
    return Number.isInteger(v) && v >= 0 && v < o.choices.length;
  });

/* ── the shops ── */

export const LOCS = [
  ['MM ALAM ROAD', 'GULBERG III, LAHORE'],
  ['CCA, DHA PHASE 5', 'DHA, LAHORE'],
  ['MAIN BOULEVARD', 'JOHAR TOWN, LAHORE'],
] as const;
// The same shops as they read in a sentence.
export const LOC_TITLES = ['MM Alam Road', 'CCA, DHA Phase 5', 'Main Boulevard, Johar Town'] as const;
// Short names, on invoices, tickets and table QR codes.
export const SHOP_CODES = ['MMA', 'DHA', 'JTN'] as const;
export const SHOP_COUNT = LOCS.length;

/* ── hours, tax, delivery, payment ── */

export const TAX = 0.16,
  PREP_MIN = 12,
  OPEN_MIN = 7 * 60,
  CLOSE_MIN = 21 * 60;
/* Punjab taxes restaurant bills at 16%, and at 5% when they are paid by card or
   a mobile wallet; the checkout shows whichever applies to the method chosen. */
export const TAX_CARD = 0.05;
/* Delivery areas: which shop sends the rider, the fee, and the time it takes. */
export const DELIVERY = {
  min: 1000,
  freeOver: 3000,
  areas: [
    // [area, shop that sends the rider, fee, minutes, km by road]
    ['GULBERG', 0, 150, 30, 3.4],
    ['MODEL TOWN', 0, 250, 40, 6.8],
    ['GARDEN TOWN', 0, 200, 35, 5.1],
    ['DHA PHASE 1–6', 1, 200, 35, 4.6],
    ['DHA PHASE 7–8', 1, 300, 45, 8.2],
    ['JOHAR TOWN', 2, 150, 30, 3.9],
    ['WAPDA TOWN', 2, 250, 40, 6.6],
  ] as [area: string, shop: number, fee: number, minutes: number, km: number][],
};
export const PAY = [
  ['CASH', 'AT THE COUNTER', 'TO THE RIDER'],
  ['CARD', 'TAP OR CHIP · 5% TAX', "ON THE RIDER'S MACHINE · 5% TAX"],
  ['JAZZCASH / EASYPAISA', 'SCAN OUR RAAST QR · 5% TAX', "SCAN THE RIDER'S QR · 5% TAX"],
] as const;

/** Pakistani mobile numbers: 03XX XXXXXXX, with or without +92 / 0092. Returns "" when it isn't one. */
export const pkMobile = (v: string) => {
  const d = String(v || '').replace(/[\s\-()]/g, '').replace(/^(\+92|0092)/, '0');
  return /^03\d{9}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4)}` : '';
};

export const money = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;
