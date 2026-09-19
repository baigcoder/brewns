export interface ProductOptionChoice {
  label: string;
  priceDelta: number;
  badge?: string;
}

export interface ProductOption {
  key: string;
  label: string;
  choices: ProductOptionChoice[];
  defaultIndex?: number;
}

export interface Product {
  id: string;
  name: string;
  category: 'beans' | 'drinks' | 'bakery' | 'merch';
  tag?: string;
  price: number;
  featured?: boolean;
  modelType: 'bag' | 'cup' | 'iced' | 'gift';
  meta: string;
  notes: string[];
  description: string;
  origin?: string;
  process?: string;
  elevation?: string;
  options: ProductOption[];
  details: [string, string][];
}

export const PRODUCTS: Product[] = [
  {
    id: 'nordic-slow-roast',
    name: 'SLOW ROAST NO. 4',
    category: 'beans',
    tag: 'SIGNATURE',
    price: 18.0,
    featured: true,
    modelType: 'bag',
    meta: '250G · WHOLE BEAN · SAN FRANCISCO',
    notes: ['TOFFEE', 'CACAO LIQUOR', 'ROASTED PECAN'],
    description: 'Our flagship seasonal roast. Developed deliberately slowly past first crack to caramelize natural bean sugars while preserving origin floral nuances.',
    origin: 'Huila, Colombia & Sidama, Ethiopia',
    process: 'Fully Washed',
    elevation: '1,850m - 2,100m',
    options: [
      {
        key: 'size',
        label: 'BAG SIZE',
        choices: [
          { label: '250 G', priceDelta: 0 },
          { label: '500 G', priceDelta: 14.0 },
          { label: '1 KG', priceDelta: 38.0 },
        ],
      },
      {
        key: 'grind',
        label: 'GRIND TYPE',
        choices: [
          { label: 'WHOLE BEAN', priceDelta: 0 },
          { label: 'ESPRESSO', priceDelta: 0 },
          { label: 'FILTER / POUR', priceDelta: 0 },
          { label: 'FRENCH PRESS', priceDelta: 0 },
        ],
      },
      {
        key: 'frequency',
        label: 'SUBSCRIPTION',
        choices: [
          { label: 'ONE TIME', priceDelta: 0 },
          { label: 'EVERY 2 WEEKS', priceDelta: -1.8, badge: 'SAVE 10%' },
          { label: 'EVERY 4 WEEKS', priceDelta: -1.8, badge: 'SAVE 10%' },
        ],
      },
    ],
    details: [
      ['ROAST LEVEL', 'MEDIUM LIGHT'],
      ['HARVEST', 'CURRENT CROP 2026'],
      ['ROASTED AT', 'MISSION ROASTERY, SF'],
      ['BAG TYPE', 'RECYCLABLE VALVE POUCH'],
    ],
  },
  {
    id: 'atelier-house-latte',
    name: 'HOUSE CERAMIC LATTE',
    category: 'drinks',
    tag: 'FAVORITE',
    price: 4.8,
    modelType: 'cup',
    meta: '12 OZ · ROAST NO. 4 · STEAMED TO ORDER',
    notes: ['CREAMY', 'SWEET HAZELNUT', 'VELVET'],
    description: 'Freshly pulled double shot of Slow Roast No. 4 enveloped in velvety steamed Clover Sonoma organic milk, poured with signature leaf latte art.',
    options: [
      {
        key: 'size',
        label: 'SIZE',
        defaultIndex: 1,
        choices: [
          { label: '8 OZ (CORTADO RATIO)', priceDelta: -0.6 },
          { label: '12 OZ (STANDARD)', priceDelta: 0 },
          { label: '16 OZ (DOUBLE EXTRACTION)', priceDelta: 0.8 },
        ],
      },
      {
        key: 'milk',
        label: 'MILK SELECTION',
        choices: [
          { label: 'ORGANIC WHOLE', priceDelta: 0 },
          { label: 'OAT MILK (OATLY BARISTA)', priceDelta: 0.6 },
          { label: 'HOUSE ALMOND', priceDelta: 0.6 },
        ],
      },
      {
        key: 'temp',
        label: 'TEMPERATURE',
        choices: [
          { label: 'HOT (60°C SERVE)', priceDelta: 0 },
          { label: 'OVER ARTISAN ICE', priceDelta: 0.3 },
        ],
      },
    ],
    details: [
      ['SHOT RATIO', '1:2.1 RISTRETTO'],
      ['MILK TEMP', '60°C MICROFOAM'],
      ['VESSEL', 'HANDMADE CERAMIC TUMBLER'],
    ],
  },
  {
    id: 'single-origin-espresso-cup',
    name: 'HUILA RESERVE ESPRESSO',
    category: 'drinks',
    price: 3.8,
    modelType: 'cup',
    meta: 'DOUBLE SHOT · UNBLENDED · PURE EXTRACTION',
    notes: ['DARK CACAO', 'BLOOD ORANGE', 'HONEYCOMB'],
    description: 'Clean, dense, high-extraction double shot pulled on custom 9-bar saturated groupheads. Served alongside sparkling mineral water.',
    options: [
      {
        key: 'shots',
        label: 'EXTRACTION',
        choices: [
          { label: 'DOUBLE (38G OUT)', priceDelta: 0 },
          { label: 'TRIPLE BASKET (48G OUT)', priceDelta: 0.9 },
        ],
      },
      {
        key: 'serve',
        label: 'SERVING STYLE',
        choices: [
          { label: 'NEAT + MINERAL SODA', priceDelta: 0 },
          { label: 'MACCHIATO STAIN', priceDelta: 0.4 },
        ],
      },
    ],
    details: [
      ['ORIGIN', 'SAN AGUSTIN, HUILA'],
      ['DOSE', '19.0 GRAMS'],
      ['TIME', '28 SECONDS'],
    ],
  },
  {
    id: 'ceremonial-iced-matcha',
    name: 'UJI ICED MATCHA',
    category: 'drinks',
    tag: 'SEASONAL',
    price: 5.5,
    modelType: 'iced',
    meta: 'FIRST FLUSH · WHISKED TABLESIDE',
    notes: ['SPRING UMBRIAN', 'SILK', 'PISTACHIO'],
    description: 'First-harvest ceremonial grade matcha from Uji, Kyoto. Whisked with bamboo chasen over chilled oat milk and clear ice spheres.',
    options: [
      {
        key: 'size',
        label: 'SIZE',
        choices: [
          { label: '12 OZ', priceDelta: 0 },
          { label: '16 OZ', priceDelta: 0.8 },
        ],
      },
      {
        key: 'sweetness',
        label: 'HOUSE VANILLA SYRUP',
        defaultIndex: 1,
        choices: [
          { label: 'UNSWEETENED (TRADITIONAL)', priceDelta: 0 },
          { label: 'LIGHT ORGANIC AGAVE', priceDelta: 0 },
          { label: 'MADAGASCAR VANILLA', priceDelta: 0.4 },
        ],
      },
    ],
    details: [
      ['GRADE', 'CEREMONIAL FIRST-HARVEST'],
      ['PROVENANCE', 'KYOTO PREFECTURE'],
      ['WATER TEMP', '74°C BREWED'],
    ],
  },
  {
    id: 'draft-nitro-cold-brew',
    name: 'DRAFT NITRO COLD BREW',
    category: 'drinks',
    price: 5.0,
    modelType: 'iced',
    meta: 'INFUSED WITH NITROGEN · GUINNESS FOAM',
    notes: ['DARK ROASTED MALT', 'STOUT FOAM', 'SMOOTH'],
    description: 'Slow cold steeped for 20 hours and kegged under pure nitrogen. Pours with a cascading creamy head and dense chocolate notes.',
    options: [
      {
        key: 'size',
        label: 'POUR SIZE',
        choices: [
          { label: '12 OZ DRAFT', priceDelta: 0 },
          { label: '16 OZ DRAFT', priceDelta: 0.8 },
        ],
      },
    ],
    details: [
      ['STEEP DURATION', '20 HOURS AT 3°C'],
      ['GAS RATIO', '100% FOOD GRADE N2'],
      ['SERVE', 'STEMLESS GLASS / TO-GO'],
    ],
  },
  {
    id: 'sourdough-morning-bun',
    name: 'WILD CARDAMOM BUN',
    category: 'bakery',
    price: 4.4,
    modelType: 'cup',
    meta: '48-HR CULTURE · ROLLER LAMINATED',
    notes: ['SOURDOUGH', 'GREEN CARDAMOM', 'BROWN SUGAR'],
    description: 'Naturally leavened viennoiserie dough layered with French Normandy cultured butter and organic Guatemalan cardamom seeds.',
    options: [
      {
        key: 'prep',
        label: 'SERVING TEMP',
        choices: [
          { label: 'ROOM TEMPERATURE (CRISP CRUST)', priceDelta: 0 },
          { label: 'GENTLY HEATED (1 MINUTE)', priceDelta: 0 },
        ],
      },
    ],
    details: [
      ['BAKED DAILY', '06:00 & 11:30'],
      ['ALLERGENS', 'WHEAT · BUTTER · EGGS'],
      ['WEIGHT', '135G'],
    ],
  },
  {
    id: 'veldt-atelier-card',
    name: 'ATELIER GIFT CARD',
    category: 'merch',
    tag: 'DIGITAL',
    price: 25.0,
    modelType: 'gift',
    meta: 'DIGITAL NFC PASS & WALLET PASS',
    notes: ['NEVER EXPIRES', 'INSTANT EMAIL DELIVERY'],
    description: 'Valid for all whole bean roasts, counter drinks, pastry pairings, and merchandise at any of our San Francisco locations.',
    options: [
      {
        key: 'balance',
        label: 'VALUE AMOUNT',
        choices: [
          { label: '$25.00', priceDelta: 0 },
          { label: '$50.00', priceDelta: 25.0 },
          { label: '$100.00', priceDelta: 75.0 },
        ],
      },
    ],
    details: [
      ['DELIVERY', 'INSTANT QR & APPLE WALLET'],
      ['VALIDITY', 'ALL 3 SF LOCATIONS + WEB'],
      ['EXPIRATION', 'NEVER EXPIRES'],
    ],
  },
];
