/** The journal: short pieces about the coffee, written by the brewns team. */
export type Post = {
  slug: string;
  title: string;
  kicker: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  excerpt: string;
  image: string;
  imageAlt: string;
  body: string[];
  cta?: { href: string; label: string };
};

export const POSTS: Post[] = [
  {
    slug: 'why-92-degrees',
    title: 'Why every shot is pulled at 92°C',
    kicker: 'At the bar',
    date: '2026-09-28',
    minutes: 4,
    excerpt: 'Two degrees either way changes the cup more than most people expect. Here is how we landed on our numbers.',
    image: '/assets/menu/cup-espresso.webp',
    imageAlt: 'A brewns espresso cup',
    body: [
      'Espresso is a race between sweetness and bitterness. Hotter water pulls everything out faster, including the harsh compounds that come at the end. Cooler water leaves the sugars behind and the shot tastes thin and sour.',
      'Slow Roast is a shade past medium, which means it gives up its flavour readily. At 94°C it ran bitter in our tests; at 90°C the caramel never showed up. 92°C was where the brown sugar and roasted almond came through without the bite.',
      'The 27 seconds follows from the same tasting. Shorter shots were bright but hollow, longer ones went dry. We weigh every dose and time every shot, so a latte in Gulberg tastes like a latte in Johar Town.',
      'Milk gets the same treatment: 65°C, never more. Past that the lactose stops tasting sweet and starts tasting cooked.',
    ],
    cta: { href: '/brew-timer', label: 'Try the brew timer' },
  },
  {
    slug: 'yirgacheffe-at-home',
    title: 'Getting the jasmine out of a Yirgacheffe',
    kicker: 'Brew at home',
    date: '2026-09-10',
    minutes: 5,
    excerpt: 'Our single origin is delicate. A pour-over recipe that keeps the florals and the peach finish intact.',
    image: '/assets/menu/bag-yirgacheffe.webp',
    imageAlt: 'A brewns Ethiopia Yirgacheffe bag',
    body: [
      'Washed heirloom coffees from Yirgacheffe are light, tea-like and easy to bury. Too fine a grind or too hot a kettle and the jasmine turns to something flat and papery.',
      'Start with 15 g of coffee to 250 g of water at 93°C, ground a little coarser than table salt. Bloom with 40 g for 40 seconds, then pour slowly in circles to 250 g by 2:30. Aim to finish draining around 3:15.',
      'If the cup tastes sharp, grind a touch finer. If it tastes dull or bitter, go coarser. Change one thing at a time.',
      'Drink it as it cools. Bergamot shows up first, the white peach arrives once it drops below 60°C.',
    ],
    cta: { href: '/#shop/single-origin', label: 'Shop Yirgacheffe' },
  },
  {
    slug: 'the-four-minute-cup',
    title: 'The four-minute cup',
    kicker: 'Behind the counter',
    date: '2026-08-22',
    minutes: 3,
    excerpt: 'Order-ahead only works if the drink is poured for when you arrive, not when you tap the button.',
    image: '/assets/menu/cup-iced-latte.webp',
    imageAlt: 'A brewns iced latte',
    body: [
      'A latte made too early is a worse latte. The foam collapses, the ice melts, the espresso goes flat. So when you order ahead, the bar does not start straight away.',
      'Each order carries the time you expect to arrive. The queue on the bar is sorted by that time, not by when the order came in, and the barista starts the shot so it lands just before you walk through the door.',
      'That is where the four minutes comes from: the average time between a customer walking in and the cup in their hand, across all three counters.',
    ],
    cta: { href: '/#order', label: 'Order ahead' },
  },
  {
    slug: 'subscription-math',
    title: 'How much coffee do you actually drink?',
    kicker: 'Subscriptions',
    date: '2026-08-05',
    minutes: 3,
    excerpt: 'A quick way to pick between every two weeks and every four, so the bag never runs dry or goes stale.',
    image: '/assets/menu/bag-slow-roast.webp',
    imageAlt: 'A brewns Slow Roast bag',
    body: [
      'A 250 g bag makes about 16 cups at 15 g a cup, or about 13 double espressos at 18 g.',
      'One cup a day? A 250 g bag every two weeks is right. Two people at two cups each? Go up to 500 g every two weeks, or 1 kg every four.',
      'Beans are at their best within four weeks of roasting, so if you find yourself with a backlog, slow the cadence down rather than buying a bigger bag.',
    ],
    cta: { href: '/subscribe', label: 'See subscription plans' },
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

export const postDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
