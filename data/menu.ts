export interface MenuItem {
  id: string;
  name: string;
  category: 'coffee' | 'signature' | 'bakery';
  description: string;
  price: number;
  image: string;
  featured: boolean;
  notes?: string[];
  specs?: string;
}

export const FEATURED_MENU: MenuItem[] = [
  {
    id: 'single-origin-espresso',
    name: 'SINGLE ORIGIN ESPRESSO',
    category: 'coffee',
    description: 'Double extraction of washed Huila beans. Syrupy body with dark chocolate, ripe cherry, and orange blossom.',
    price: 3.5,
    image: '/images/menu-espresso.svg',
    featured: true,
    notes: ['DARK CACAO', 'RED CHERRY', 'ORANGE PEEL'],
    specs: '18.5g in · 38g out · 27 sec',
  },
  {
    id: 'veldt-flat-white',
    name: 'ATELIER FLAT WHITE',
    category: 'coffee',
    description: 'Ristretto blend paired with silky microfoam textured to 60°C. Delicately sweet, creamy, and balanced.',
    price: 4.8,
    image: '/images/menu-latte.svg',
    featured: true,
    notes: ['BROWN SUGAR', 'TOASTED HAZELNUT', 'SWEET CREMA'],
    specs: '6 oz · Double Shot · Whole Milk',
  },
  {
    id: 'slow-drip-cold-brew',
    name: 'KYOTO SLOW DRIP',
    category: 'signature',
    description: 'Extracted drop-by-drop over 14 hours through cold filtered water. Ultra-smooth with zero astringency.',
    price: 5.2,
    image: '/images/menu-iced.svg',
    featured: true,
    notes: ['BLACK CURRANT', 'COCOA NIB', 'VANILLA'],
    specs: '12 oz · 14-hr Cold Steep · Over Clear Ice',
  },
  {
    id: 'nordic-cardamom-knot',
    name: 'CARDAMOM KNOT',
    category: 'bakery',
    description: 'Laminated brioche dough layered with stoneground green cardamom, brown butter, and crystallized pearl sugar.',
    price: 4.4,
    image: '/images/menu-bun.svg',
    featured: true,
    notes: ['WILD CARDAMOM', 'BROWN BUTTER', 'PEARL SUGAR'],
    specs: 'Baked fresh daily at 06:30',
  },
  {
    id: 'gibraltar-cortado',
    name: 'GIBRALTAR CORTADO',
    category: 'coffee',
    description: 'Equal parts double shot Slow Roast espresso and warm textured microfoam in a faceted Gibraltar glass.',
    price: 3.9,
    image: '/assets/menu/menu-cortado.jpg',
    featured: true,
    notes: ['VELVETY', 'HAZELNUT', 'SWEET CARAMEL'],
    specs: '4.5 oz · 1:1 Ratio · 135°F Microfoam',
  },
  {
    id: 'nitro-draft-cold-brew',
    name: 'NITRO COLD BREW',
    category: 'signature',
    description: 'Slow steeped for twenty hours and charged with pure food-grade nitrogen on draft. Creamy cascading head.',
    price: 5.0,
    image: '/assets/menu/menu-cold-brew.jpg',
    featured: true,
    notes: ['STOUT-LIKE', 'CREAMY CACAO', 'NATURAL SWEETNESS'],
    specs: '12 oz · 20-hr Cold Steep · Nitrogen Draft',
  },
  {
    id: 'uji-matcha-financier',
    name: 'MATCHA FINANCIER',
    category: 'bakery',
    description: 'Dense French almond cake infused with ceremonial Uji matcha and browned noisette butter. Naturally gluten-free.',
    price: 4.0,
    image: '/assets/menu/menu-financier.jpg',
    featured: true,
    notes: ['ALMOND FLOUR', 'UJI MATCHA', 'NOISETTE BUTTER'],
    specs: '90g · California Almond · Gluten-Free',
  },
  {
    id: 'glazed-cinnamon-roll',
    name: 'CINNAMON ROLL',
    category: 'bakery',
    description: 'Laminated dough rolled with brown butter, cinnamon and a little cardamom, finished with warm vanilla glaze.',
    price: 3.8,
    image: '/assets/menu/menu-cinnamon.webp',
    featured: true,
    notes: ['BROWN BUTTER', 'VIETNAMESE CINNAMON', 'VANILLA GLAZE'],
    specs: '140g · Fresh from 06:00 Daily',
  },
];
