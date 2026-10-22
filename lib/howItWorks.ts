/* The "How brewns works" film: one minute through the site, from the menu to
   the phone. Its chapters, captions and transcript all come from here, so the
   page, the captions track and the search data can never disagree. */

export const FILM = {
  title: 'How brewns works',
  description: 'One minute through brewns: order ahead, make your cup your own, pay and skip the line, beans for home, the counters, Sarah on the phone, and the same site on your phone.',
  path: '/how-it-works',
  poster: '/assets/film/how-it-works/how-it-works-poster.webp',
  sources: {
    large: { webm: '/assets/film/how-it-works/how-it-works-1080.webm', mp4: '/assets/film/how-it-works/how-it-works-1080.mp4' },
    small: { webm: '/assets/film/how-it-works/how-it-works-720.webm', mp4: '/assets/film/how-it-works/how-it-works-720.mp4' },
  },
  captions: '/how-it-works/captions.vtt',
  seconds: 62,
  uploaded: '2026-10-21',
};

export type Chapter = { at: number; title: string; body: string; href?: string; label?: string };

export const CHAPTERS: Chapter[] = [
  { at: 0, title: 'Open the menu', body: 'Espresso, lattes and cinnamon rolls still warm from the oven, all on one page.', href: '/#menu', label: 'See the menu' },
  { at: 16, title: 'Make it yours', body: 'Tap any cup and it opens in 3D. Spin it, then pick your size and your milk.', href: '/shop/latte', label: 'Try the latte' },
  { at: 25, title: 'Skip the line', body: 'Pay ahead and your cup is poured to meet you, about four minutes door to cup.', href: '/#order', label: 'Order ahead' },
  { at: 29, title: 'Beans for home', body: 'Roasted every week here in Lahore and delivered to your door.', href: '/shop#beans', label: 'Shop beans' },
  { at: 35, title: 'Find a counter', body: 'Three counters across the city, with directions to the closest one.', href: '/locations', label: 'Our locations' },
  { at: 39, title: 'Or just call', body: 'Sarah, our AI concierge, books your table in English or Urdu.', href: '/reserve', label: 'Book a table' },
  { at: 43, title: 'Gifts and more', body: 'Gift cards, a bean subscription and a brew timer for your kitchen.', href: '/gift-cards', label: 'Gift cards' },
  { at: 51, title: 'On your phone', body: 'Every page and every detail, the same on your phone.' },
];

/** The voice-over, as said: [start, end, words]. */
export const CUES: [number, number, string][] = [
  [1.4, 5.6, 'It’s 7 am in Lahore and you need coffee. Like, right now.'],
  [6.1, 8.6, 'So you open brewns.'],
  [8.7, 11.3, 'The whole menu is right here.'],
  [11.4, 16.3, 'Espresso, lattes, cinnamon rolls still warm from the oven.'],
  [16.6, 19.4, 'Tap anything and it opens up in 3D.'],
  [19.5, 25.3, 'Spin it around, pick your size, your milk, add it to your bag.'],
  [25.4, 28.4, 'Pay ahead and skip the line completely.'],
  [29.3, 30.5, 'Want beans for home?'],
  [30.6, 33.3, 'We roast every single week, right here in Lahore.'],
  [33.4, 35.0, 'And we’ll ship them to your door.'],
  [35.2, 37.2, 'Three counters across the city.'],
  [37.3, 39.2, 'Find the closest one in seconds.'],
  [43.7, 48.3, 'Gift cards, subscriptions, even a brew timer for your kitchen.'],
  [51.8, 53.6, 'And on your phone, same thing.'],
  [54.1, 56.4, 'Every page, every detail.'],
  [57.3, 60.5, 'brewns. Coffee for your moment.'],
];

/** 75 → "1:15" */
export const clockTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
