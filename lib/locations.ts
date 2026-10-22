/** The three brewns counters, for the locations and about pages. */
export type Cafe = {
  id: string;
  name: string;
  area: string;
  nickname: string;
  blurb: string;
  features: string[];
  mapQuery: string;
};

export const CAFES: Cafe[] = [
  {
    id: 'mm-alam',
    name: 'MM Alam Road',
    area: 'Gulberg III, Lahore',
    nickname: 'The first counter',
    blurb: 'Where brewns started. A long bar you can watch, leather sofas at the back and the busiest espresso machine we own.',
    features: ['Coffee bar seats', 'Full kitchen', 'Free Wi-Fi & charging', 'Street & valet parking'],
    mapQuery: 'MM Alam Road Gulberg III Lahore',
  },
  {
    id: 'dha-5',
    name: 'CCA, DHA Phase 5',
    area: 'DHA, Lahore',
    nickname: 'The green room',
    blurb: 'Warm light and green corners, with the quietest tables for working mornings and long conversations.',
    features: ['Table reservations', 'Full kitchen', 'Free Wi-Fi & charging', 'CCA parking'],
    mapQuery: 'CCA DHA Phase 5 Lahore',
  },
  {
    id: 'johar-town',
    name: 'Main Boulevard',
    area: 'Johar Town, Lahore',
    nickname: 'The quick stop',
    blurb: 'Built around order-ahead: tap, pull up and pick up. Same recipe, same 92°C, a few minutes from the canal.',
    features: ['Order-ahead pickup', 'Full kitchen', 'Free Wi-Fi & charging', 'Parking out front'],
    mapQuery: 'Main Boulevard Johar Town Lahore',
  },
];

export const mapsUrl = (c: Pick<Cafe, 'mapQuery'>) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.mapQuery)}`;

export const CAFE_PHONE = '+92 42 1234 5678';
export const CAFE_EMAIL = 'hello@brewns.coffee';

/** A Google map of the counter, for an <iframe> (no API key needed). */
export const mapEmbedUrl = (c: Pick<Cafe, 'mapQuery'>) => `https://www.google.com/maps?q=${encodeURIComponent(c.mapQuery)}&output=embed`;
export const cafeById = (id: string) => CAFES.find((c) => c.id === id);
