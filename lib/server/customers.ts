/* Customer accounts and their brewns Club card.

   A signed-in customer's card lives here rather than in their browser, so it
   follows them to any phone, and the server is the one that stamps it: stamps
   land when an order is placed and come back off when it's cancelled. The
   rules are the same pure functions the site uses (components/brewns/club.ts). */

import { addStamps, birthdayTreat, CLUB, emptyClub, memberNumber, normaliseClub, reverseOrder, spendReward, stampsFor, type ClubState } from '@/components/brewns/club';
import { pkMinutes } from '@/lib/orderFlow';
import { getUser, saveUser, type User } from './auth';
import { kv, withLock } from './store';

export const customerView = (u: User) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, since: u.createdAt });

/** The card as it stands now, with a birthday drink added if one is due. */
export async function clubOf(u: User): Promise<ClubState> {
  const state = normaliseClub(u.club);
  const { state: next, given } = birthdayTreat(state);
  if (given) await saveUser({ ...u, club: next });
  return next;
}

export async function joinClub(u: User, birthday: string) {
  return withLock(`user:${u.id}`, async () => {
    const fresh = (await getUser(u.id)) || u;
    if (fresh.club?.member) return normaliseClub(fresh.club);
    const now = Date.now();
    const digits = fresh.phone.replace(/\D/g, '');
    let state: ClubState = { ...emptyClub(), member: { name: fresh.name, phone: fresh.phone, birthday, since: now, no: memberNumber(+digits.slice(-9) || now % 1e9) } };
    state = addStamps(state, CLUB.welcomeStamps, { t: now, kind: 'join' }).state;
    // Orders from the last day count too, so ordering first and joining after loses nothing.
    const { getOrder } = await import('./orders');
    for (const ref of await customerOrderRefs(fresh.id, 20)) {
      if (now - ref.placed > CLUB.claimWindowMs || !ref.lines) continue;
      const o = await getOrder(ref.number);
      if (!o || o.status === 'cancelled' || o.club?.stamps) continue;
      state = addStamps(state, stampsFor(ref.lines, pkMinutes(ref.placed)), { t: ref.placed, kind: 'order', order: ref.number }).state;
    }
    state = birthdayTreat(state).state;
    await saveUser({ ...fresh, club: state });
    return state;
  });
}

export async function leaveClub(u: User) {
  await saveUser({ ...u, club: emptyClub() });
  return emptyClub();
}

/** Brings a card kept on this device into the account, once. */
export async function importClub(u: User, card: unknown) {
  return withLock(`user:${u.id}`, async () => {
    const fresh = (await getUser(u.id)) || u;
    const local = normaliseClub(card);
    if (fresh.clubImported || fresh.club?.member || !local.member) return { state: normaliseClub(fresh.club), imported: false };
    // Only what a card can plausibly hold; the stamps themselves are taken on trust, as the device card always was.
    const state: ClubState = { ...local, rewards: Math.min(local.rewards, 3), member: { ...local.member, name: fresh.name, phone: fresh.phone || local.member.phone } };
    await saveUser({ ...fresh, club: state, clubImported: true });
    return { state, imported: true };
  });
}

/** Stamps an order onto a member's card (and takes off the free drink it used). */
export async function creditOrder(userId: string, order: { number: number; placed: number; lines: { cat: string; qty: number; unit: number }[]; usedReward: boolean }) {
  return withLock(`user:${userId}`, async () => {
    const u = await getUser(userId);
    if (!u?.club?.member) return null;
    let state = normaliseClub(u.club);
    if (state.credited.includes(order.number)) return null;
    if (order.usedReward) state = spendReward(state, order.number, order.placed);
    const stamps = stampsFor(order.lines, pkMinutes(order.placed), order.usedReward ? 1 : 0);
    const { state: next, earned } = addStamps(state, stamps, { t: order.placed, kind: 'order', order: order.number });
    await saveUser({ ...u, club: next });
    return { stamps, earned, used: order.usedReward, left: CLUB.stampsPerReward - next.stamps, rewards: next.rewards, state: next };
  });
}

export async function reverseCredit(userId: string, number: number, stamps: number, used: boolean) {
  return withLock(`user:${userId}`, async () => {
    const u = await getUser(userId);
    if (!u?.club) return;
    await saveUser({ ...u, club: reverseOrder(normaliseClub(u.club), number, stamps, used) });
  });
}

/* ── a customer's orders ── */

export type OrderRef = { number: number; day: string; placed: number; total: number; mode: string; lines?: { cat: string; qty: number; unit: number }[] };

export const addCustomerOrder = (userId: string, ref: OrderRef) => kv.push(`customer-orders:${userId}`, ref, 200);
export const customerOrderRefs = (userId: string, limit = 50) => kv.list<OrderRef>(`customer-orders:${userId}`, 0, limit - 1);
