/* In-app voice calls between a delivery customer and their rider, so neither sees the other's number.
   The audio goes browser to browser (WebRTC); the server only passes the two halves of the handshake,
   each with all its network candidates in it, so polling is enough.

   rtc   order number → the call on it (one at a time) */

import { isOpen } from '@/lib/orderFlow';
import type { ServerOrder } from '@/lib/orderFlow';
import { fail } from './http';
import { bumpLive } from './orders';
import { kv, withLock } from './store';

export type Side = 'you' | 'rider';
export type RtcCall = { from: Side; offer: string; answer?: string; t: number; ended?: number };
export type CallState = 'ringing' | 'live' | 'ended';

const KEY = 'rtc';
export const RING_MS = 45000;
const MAX_SDP = 20000;

export const callState = (c: RtcCall, now = Date.now()): CallState => (c.ended ? 'ended' : c.answer ? 'live' : now - c.t > RING_MS ? 'ended' : 'ringing');

/** The call on an order, if any. One that ended a while ago is cleared. */
export async function getCall(number: number) {
  const c = await kv.hget<RtcCall>(KEY, number);
  if (c && callState(c) === 'ended' && Date.now() - (c.ended || c.t + RING_MS) > 60000) {
    await kv.hdel(KEY, number);
    return null;
  }
  return c;
}

/** What a poll shows: the state, and the handshake halves the other side needs. */
export const callView = (c: RtcCall | null) => (c ? { from: c.from, state: callState(c), offer: c.offer, answer: c.answer || null } : null);

/** Every call still ringing or on, by order number (the riders' live poll picks theirs out). */
export async function liveCalls() {
  const all = Object.entries(await kv.hall<RtcCall>(KEY));
  const stale = all.filter(([, c]) => callState(c) === 'ended' && Date.now() - (c.ended || c.t + RING_MS) > 60000).map(([n]) => n);
  if (stale.length) await kv.hdel(KEY, ...stale);
  return all
    .filter(([, c]) => callState(c) !== 'ended')
    .map(([n, c]) => ({ number: Number(n), from: c.from, state: callState(c) }));
}

/** Start (`offer`), pick up (`answer`) or hang up (`end`). The route has already checked who is calling. */
export async function callAct(o: ServerOrder, side: Side, b: { op?: unknown; sdp?: unknown }) {
  const sdp = String(b.sdp ?? '');
  if (b.op !== 'end' && (!sdp.startsWith('v=0') || sdp.length > MAX_SDP)) fail(400, 'That call could not be set up.');
  const c = await withLock(`rtc:${o.number}`, async () => {
    const cur = await kv.hget<RtcCall>(KEY, o.number);
    const state = cur && callState(cur);
    let next: RtcCall;
    if (b.op === 'offer') {
      if (o.mode !== 'delivery' || !o.rider || !isOpen(o.status)) fail(409, 'Calls are for a delivery on its way, once a rider has it.');
      if (state === 'ringing' || state === 'live') fail(409, 'There is already a call on this order.');
      next = { from: side, offer: sdp, t: Date.now() };
    } else if (b.op === 'answer') {
      if (state !== 'ringing' || cur!.from === side) fail(409, 'That call has ended.');
      next = { ...cur!, answer: sdp };
    } else if (b.op === 'end') {
      if (!cur || state === 'ended') return cur;
      next = { ...cur, ended: Date.now() };
    } else return fail(400, 'Unknown call action.');
    await kv.hset(KEY, o.number, next);
    return next;
  });
  await bumpLive(); // the rider's console hears the ring or the hang-up on its next poll
  return callView(c);
}
