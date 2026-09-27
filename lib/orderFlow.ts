/* The life of an order once the café has it: its statuses, the stations that
   make it, and how the café's status reads on the customer's tracker.

   Pure and shared: the server moves orders along these rules, the console
   draws its buttons from them, and the site's tracker (orderLive.ts) shows
   `customerStage()` instead of the clock once an order is on the server. */

export type Mode = 'pickup' | 'delivery' | 'dinein';
export type Status = 'received' | 'accepted' | 'preparing' | 'ready' | 'onway' | 'arriving' | 'delivered' | 'collected' | 'served' | 'cancelled';
export type Station = 'bar' | 'kitchen' | 'counter';
export type StationState = 'queued' | 'making' | 'done';

export const FLOW: Record<Mode, Status[]> = {
  pickup: ['received', 'accepted', 'preparing', 'ready', 'collected'],
  delivery: ['received', 'accepted', 'preparing', 'ready', 'onway', 'arriving', 'delivered'],
  dinein: ['received', 'accepted', 'preparing', 'ready', 'served'],
};

export const DONE: readonly Status[] = ['collected', 'delivered', 'served', 'cancelled'];
export const isOpen = (s: Status) => !DONE.includes(s);

export const STATUS_LABEL: Record<Status, string> = {
  received: 'New',
  accepted: 'Accepted',
  preparing: 'Making',
  ready: 'Ready',
  onway: 'On the road',
  arriving: 'Arriving',
  delivered: 'Delivered',
  collected: 'Collected',
  served: 'Served',
  cancelled: 'Cancelled',
};

export const MODE_LABEL: Record<Mode, string> = { pickup: 'Pickup', delivery: 'Delivery', dinein: 'Table' };

export const STATION_LABEL: Record<Station, string> = { bar: 'Bar', kitchen: 'Kitchen', counter: 'Counter' };

/** Which station makes a product: the bar pours and warms, the kitchen cooks, the counter hands over beans, merch and gift cards. */
export const stationFor = (cat: string): Station => (cat === 'kitchen' ? 'kitchen' : cat === 'drinks' || cat === 'coolers' || cat === 'bakery' ? 'bar' : 'counter');

/** Stations that actually make something, so they get a ticket on the kitchen screen. */
export const PREP_STATIONS: readonly Station[] = ['bar', 'kitchen'];

export type Totals = { sub: number; discount: number; promo: number; reward: number; fee: number; rate: number; tax: number; total: number };

export type OrderLine = { id: string; qty: number; sel: Record<string, number>; name: string; opts: string; unit: number; total: number; cat: string; station: Station; done?: boolean };
export type OrderEvent = { t: number; what: string; status?: Status; by?: string; role?: string };
export type OrderMessage = { id: string; from: 'you' | 'cafe' | 'rider'; text: string; t: number; by?: string };

export type ServerOrder = {
  number: number;
  day: string;
  placed: number;
  target: number;
  mode: Mode;
  loc: number;
  area: number | null;
  table: number | null;
  address: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  pay: number;
  items: OrderLine[];
  totals: Totals;
  promoCode: string;
  pickupAt: { t: number; tomorrow: boolean };
  status: Status;
  stations: Partial<Record<Station, StationState>>;
  events: OrderEvent[];
  messages: OrderMessage[];
  /** Customer messages the café has read. */
  readByCafe: number;
  rider: { id: string; name: string; plate: string } | null;
  paid: { t: number; by: string; method: number } | null;
  source: 'online' | 'counter' | 'table';
  takenBy: { id: string; name: string } | null;
  customerId: string | null;
  /** The customer's secret for tracking this order without an account. */
  key: string;
  club: { stamps: number; used: boolean; verified: boolean } | null;
  cancelReason?: string;
  demo?: boolean;
};

/** Stations with something to make on this order. */
export const stationsOf = (items: Pick<OrderLine, 'station'>[]) => [...new Set(items.map((i) => i.station))].filter((s) => PREP_STATIONS.includes(s));

/** Where an order stands after a station changes: making once anyone starts, ready once every station is done. */
export function statusAfterStations(o: Pick<ServerOrder, 'status' | 'stations'>): Status {
  if (!['received', 'accepted', 'preparing'].includes(o.status)) return o.status;
  const states = Object.values(o.stations);
  if (states.length && states.every((s) => s === 'done')) return 'ready';
  if (states.some((s) => s === 'making' || s === 'done')) return 'preparing';
  return o.status;
}

/* ── the customer's view ── */

/** The stage key the site's tracker shows (see orderLive.ts `timeline()`). */
export function customerStage(o: Pick<ServerOrder, 'status' | 'mode' | 'rider'>): string {
  if (o.status === 'cancelled') return 'cancelled';
  // A delivery shows its rider as soon as one is on it; until then "ready" still reads as being made.
  if (o.mode === 'delivery' && ['accepted', 'preparing', 'ready'].includes(o.status)) return o.rider ? 'rider' : o.status === 'ready' ? 'preparing' : o.status;
  return o.status;
}

/** When each customer stage was reached, from the order's history. */
export function stageTimes(o: Pick<ServerOrder, 'events' | 'mode' | 'placed'>): Record<string, number> {
  const times: Record<string, number> = { received: o.placed };
  for (const e of o.events) {
    if (e.status && !(e.status in times)) times[e.status] = e.t;
    if (e.what === 'rider' && !('rider' in times)) times.rider = e.t;
  }
  // A step the café skipped (straight from accepted to ready) still reads as reached.
  const flow = o.mode === 'delivery' ? ['received', 'accepted', 'preparing', 'rider', 'onway', 'arriving', 'delivered'] : FLOW[o.mode];
  for (let i = flow.length - 2; i >= 0; i--) if (!(flow[i] in times) && flow[i + 1] in times) times[flow[i]] = times[flow[i + 1]];
  return times;
}

/** Minutes an order has been waiting since it was placed, for the kitchen timers. */
export const ageMin = (placed: number, now = Date.now()) => Math.max(0, Math.floor((now - placed) / 60000));

/* ── time in Lahore ── */

const PK_OFFSET = 5 * 3600000; // Pakistan Standard Time, UTC+5 all year.
/** The day an instant falls on in Lahore, as YYYY-MM-DD. */
export const pkDay = (t: number) => new Date(t + PK_OFFSET).toISOString().slice(0, 10);
/** Minutes past midnight in Lahore. */
export const pkMinutes = (t: number) => {
  const d = new Date(t + PK_OFFSET);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
/** Midnight in Lahore for the day `t` falls on, as an instant. */
export const pkMidnight = (t: number) => t - (((t + PK_OFFSET) % 86400000) + 86400000) % 86400000;
export const pkHour = (t: number) => Math.floor(pkMinutes(t) / 60);
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const clock = (t: number) => hhmm(pkMinutes(t));
export const orderNo = (n: number) => `#${String(n).padStart(5, '0')}`;
