/* Rules for table bookings, shared by the website form and the AI phone line so
   both hold the same line: an unguessable code, no double-booking the same
   guest, and no more tables promised for a slot than the shop has. Pure. */

import { pkMobile, slotMinutes } from './catalog';

export const SEATS_PER_TABLE = 4;
/** How far ahead a table can be booked. */
export const BOOK_AHEAD_DAYS = 60;

export const tablesFor = (guests: number) => Math.max(1, Math.ceil(guests / SEATS_PER_TABLE));

/**
 * "RES-483920": six digits, so a code can't be found by trying them (4 digits was 9,000 tries).
 * Six digits are still easy to read out on a phone line. `random` is injectable for tests.
 */
export function newBookingCode(prefix: string, random: (max: number) => number = (max) => crypto.getRandomValues(new Uint32Array(1))[0] % max): string {
  return `${prefix}-${100000 + random(900000)}`;
}

/** A code not already in `taken`. Six digits are unguessable but not unique: among a thousand bookings a repeat is about 40% likely. */
export function uniqueBookingCode(prefix: string, taken: ReadonlySet<string>, random?: (max: number) => number): string {
  for (let i = 0; i < 50; i++) {
    const code = newBookingCode(prefix, random);
    if (!taken.has(code)) return code;
  }
  throw new Error('Could not make a unique booking code.');
}

/** "5:00 PM", "05:00 PM" or "17:00" as minutes past midnight. */
export function bookingMinutes(time: string): number | null {
  const t = time.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return slotMinutes(t);
}

export type Booked = { loc: number; date: string; time: string; guests: number; status: string; phone: string };

/**
 * Why this booking can't be made, as a sentence, or '' if it can.
 * `existing` is every booking on the books; `tables` is how many tables the shop has.
 */
export function bookingProblem(existing: readonly Booked[], want: { loc: number; date: string; time: string; guests: number; phone: string }, tables: number): string {
  const at = bookingMinutes(want.time);
  const live = existing.filter((b) => b.status !== 'cancelled' && b.loc === want.loc && b.date === want.date && bookingMinutes(b.time) === at);
  // The same mobile number, however it was typed (0300…, +92 300…, spaces).
  const same = (p: string) => (pkMobile(p) || p.replace(/\D/g, '')) === (pkMobile(want.phone) || want.phone.replace(/\D/g, ''));
  if (live.some((b) => same(b.phone))) return 'You already have a booking at that time. Call the shop if you need to change it.';
  if (tables > 0) {
    const taken = live.reduce((n, b) => n + tablesFor(b.guests), 0);
    if (taken + tablesFor(want.guests) > tables) return 'That time is fully booked at this shop. Try another time, or another shop.';
  }
  return '';
}

/** Is this YYYY-MM-DD no later than `BOOK_AHEAD_DAYS` after `today`? */
export function withinBookAhead(date: string, today: string): boolean {
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + BOOK_AHEAD_DAYS);
  return date <= limit.toISOString().slice(0, 10);
}
