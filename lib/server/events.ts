/* A privacy-first funnel: how many visits turned into bags, checkouts and orders.

   Only anonymous daily counts are kept (one number per event per day). No
   cookie, no IP, no user id and no page URL is stored, so there is nothing to
   consent to and nothing to leak. The browser skips it entirely when Do Not
   Track is on. Days are counted in Pakistan time, so "today" matches the shops. */

import { kv } from './store';

/** In funnel order: each step is something fewer people do than the one before. */
export const EVENTS = ['visit', 'add_to_bag', 'bag_open', 'checkout_start', 'order_placed'] as const;
export type SiteEvent = (typeof EVENTS)[number];

export const EVENT_LABEL: Record<SiteEvent, string> = {
  visit: 'Visited the site',
  add_to_bag: 'Added something to the bag',
  bag_open: 'Opened the bag',
  checkout_start: 'Started checkout',
  order_placed: 'Placed an order',
};

const KEEP_SEC = 90 * 86400;
const PKT_OFFSET_MS = 5 * 3600 * 1000;

export const isEvent = (v: unknown): v is SiteEvent => typeof v === 'string' && (EVENTS as readonly string[]).includes(v);

/** The date (YYYY-MM-DD) in Pakistan time. */
export const dayKey = (ms = Date.now()) => new Date(ms + PKT_OFFSET_MS).toISOString().slice(0, 10);

/** The last `n` days ending today, oldest first. */
export const lastDays = (n: number, now = Date.now()) => Array.from({ length: n }, (_, i) => dayKey(now - (n - 1 - i) * 86400_000));

export async function recordEvent(e: SiteEvent) {
  await kv.incr(`ev:${dayKey()}:${e}`, KEEP_SEC);
}

export type FunnelDay = { day: string } & Record<SiteEvent, number>;
export type FunnelStep = { event: SiteEvent; label: string; count: number; ofVisits: number | null; ofPrevious: number | null };

/** Counts per day, oldest first. */
export async function funnelDays(days: number): Promise<FunnelDay[]> {
  return Promise.all(
    lastDays(days).map(async (day) => {
      const counts = await Promise.all(EVENTS.map((e) => kv.num(`ev:${day}:${e}`)));
      return { day, ...(Object.fromEntries(EVENTS.map((e, i) => [e, counts[i]])) as Record<SiteEvent, number>) };
    }),
  );
}

/** Totals and the share that carried on from the visit and from the step before. */
export function funnelSteps(days: readonly Record<SiteEvent, number>[]): FunnelStep[] {
  const totals = Object.fromEntries(EVENTS.map((e) => [e, days.reduce((s, d) => s + (d[e] || 0), 0)])) as Record<SiteEvent, number>;
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 1000) / 10) : null);
  return EVENTS.map((event, i) => ({
    event,
    label: EVENT_LABEL[event],
    count: totals[event],
    ofVisits: i === 0 ? null : pct(totals[event], totals.visit),
    ofPrevious: i === 0 ? null : pct(totals[event], totals[EVENTS[i - 1]]),
  }));
}
