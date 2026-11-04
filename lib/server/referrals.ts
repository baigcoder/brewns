/* Refer a friend, on the server: each customer's own code, the thank-you codes they
   earn, and paying out when a friend's first order is collected or delivered.
   The rules themselves are in lib/referral.ts. */

import { randomInt } from 'node:crypto';
import { REFERRAL, inviteCode, type RefCode } from '@/lib/referral';
import type { ServerOrder } from '@/lib/orderFlow';
import type { User } from './auth';
import { kv } from './store';

export type Referral = { code: string; invited: number; earned: number };

const ofKey = (uid: string) => `ref:of:${uid}`;
const codeKey = (code: string) => `refcode:${code}`;
const thanksKey = (uid: string) => `ref:thanks:${uid}`;
/** One friend's discount per mobile number, ever. */
export const refUsedKey = (phone: string) => `ref-used:${phone}`;

export const findRefCode = (code: string) => (code ? kv.get<RefCode>(codeKey(code)) : Promise.resolve(null));

/** The customer's own code, made the first time they ask for it. */
export async function referralOf(u: User): Promise<Referral> {
  const have = await kv.get<Referral>(ofKey(u.id));
  if (have) return have;
  for (let i = 0; i < 20; i++) {
    const code = inviteCode(u.name, randomInt(1000));
    const claim: RefCode = { kind: 'invite', owner: u.id, ownerPhone: (u.phone || '').replace(/\D/g, '') };
    if (await kv.set(codeKey(code), claim, { nx: true })) {
      const r: Referral = { code, invited: 0, earned: 0 };
      await kv.set(ofKey(u.id), r);
      return r;
    }
  }
  throw new Error('Could not find a free referral code.');
}

/** Thank-you codes the customer has not spent yet. */
export async function openThanks(uid: string) {
  const all = await kv.hall<{ amount: number; t: number }>(thanksKey(uid));
  const codes = Object.entries(all);
  const used = await Promise.all(codes.map(([code]) => findRefCode(code)));
  return codes.filter((_, i) => used[i]?.kind === 'thanks' && !used[i]!.used).map(([code, v]) => ({ code, amount: v.amount, t: v.t }));
}

const bump = async (uid: string, field: 'invited' | 'earned', by: number) => {
  const r = await kv.get<Referral>(ofKey(uid));
  if (r) await kv.set(ofKey(uid), { ...r, [field]: r[field] + by });
};

export const countInvite = (owner: string) => bump(owner, 'invited', 1);

/** A thank-you code is spent: once, by its owner. False if another order got there first. */
export async function spendThanks(code: string, c: Extract<RefCode, { kind: 'thanks' }>, number: number) {
  if (!(await kv.set(`ref-spent:${code}`, number, { nx: true }))) return false;
  await kv.set(codeKey(code), { ...c, used: number });
  return true;
}

/** The order that spent it never went through: the code is the customer's again. */
export async function unspendThanks(code: string, c: Extract<RefCode, { kind: 'thanks' }>) {
  await kv.set(codeKey(code), { ...c, used: undefined });
  await kv.del(`ref-spent:${code}`);
}

/**
 * The friend's order is in the customer's hands: the customer who invited them gets their code.
 * Called from saveOrder, so it runs once whichever screen finished the order.
 */
export async function settleReferral(o: ServerOrder) {
  const r = o.referral;
  if (!r || r.settled || !['collected', 'delivered', 'served'].includes(o.status)) return;
  r.settled = true;
  // Claimed by order number, so two saves of the same order cannot both pay out.
  if (!(await kv.set(`ref-paid:${o.number}`, 1, { nx: true }))) return;
  for (let i = 0; i < 20; i++) {
    const code = `THANKS${randomInt(100000, 1000000)}`;
    const thanks: RefCode = { kind: 'thanks', owner: r.owner, amount: REFERRAL.get };
    if (await kv.set(codeKey(code), thanks, { nx: true })) {
      await kv.hset(thanksKey(r.owner), code, { amount: REFERRAL.get, t: Date.now() });
      await bump(r.owner, 'earned', REFERRAL.get);
      return;
    }
  }
}

/** Removes them with the account. */
export async function deleteReferral(uid: string) {
  const r = await kv.get<Referral>(ofKey(uid));
  const thanks = Object.keys(await kv.hall(thanksKey(uid)));
  await kv.del(ofKey(uid), thanksKey(uid), ...(r ? [codeKey(r.code)] : []), ...thanks.map(codeKey));
}
