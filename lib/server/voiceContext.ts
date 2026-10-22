/* Who is on the line, so the concierge can treat a regular like a regular.

   Every voice route (a live call, the step-by-step line, a chat message) works
   out the caller once and runs the rest of the request inside that context,
   so the persona can greet them by name and the tools can check "their" order
   without anyone threading it through every function. Signed-in guests are
   recognised from their session; nobody else's details are ever looked up. */

import { AsyncLocalStorage } from 'node:async_hooks';
import { CLUB, normaliseClub } from '@/components/brewns/club';
import { catalogItem } from '@/lib/catalog';
import { usualOf } from '@/lib/usual';
import { currentCustomer } from './auth';
import { customerOrderRefs } from './customers';
import { getOrder } from './orders';
import { getSettings } from './settings';

export type VoiceCaller = {
  /** The signed-in customer's account id, if there is one. */
  userId?: string;
  firstName?: string;
  phone?: string;
  /** Menu ids nobody can order today. */
  soldOut: string[];
  /** What the model is told about this caller and about today. */
  note: string;
};

const store = new AsyncLocalStorage<VoiceCaller>();
const NOBODY: VoiceCaller = { soldOut: [], note: '' };

/** The caller of the request being handled, or nobody in particular. */
export const voiceCaller = () => store.getStore() ?? NOBODY;
/** Run `fn` with `caller` as the person on the line. */
export const asCaller = <T>(caller: VoiceCaller, fn: () => Promise<T>) => store.run(caller, fn);

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Work out who is calling (from their session) and what's off the menu today. */
export async function readCaller(): Promise<VoiceCaller> {
  const [user, settings] = await Promise.all([currentCustomer().catch(() => null), getSettings().catch(() => null)]);
  const soldOut = [...new Set([...(settings?.soldOut ?? []), ...Object.entries(settings?.stock ?? {}).filter(([, n]) => n <= 0).map(([id]) => id)])];
  const lines: string[] = [];

  if (soldOut.length) {
    const names = soldOut.map((id) => catalogItem(id)?.name).filter(Boolean).map((n) => title(n!));
    if (names.length) lines.push(`Sold out today: ${names.join(', ')}. Never offer or add these; if asked, say sorry, it's finished for today, and suggest something close.`);
  }

  if (!user) return { soldOut, note: lines.length ? `\n\nToday at the café:\n- ${lines.join('\n- ')}` : '' };

  const firstName = user.name.split(/\s+/)[0] || user.name;
  const about = [`The caller is signed in to the website as ${firstName}${user.phone ? `, mobile ${user.phone}` : ''}. You know them: greet them by first name once, naturally.`];
  try {
    const refs = await customerOrderRefs(user.id, 20);
    const orders = (await Promise.all(refs.map((r) => getOrder(r.number)))).filter((o) => o && o.customerId === user.id);
    const usual = usualOf(orders.map((o) => ({ placed: o!.placed, status: o!.status, items: o!.items })), 2);
    if (usual.length) about.push(`Their usual: ${usual.map((u) => `${title(u.name)}${u.opts ? ` (${u.opts.toLowerCase()})` : ''}, ordered ${u.times} times`).join('; ')}. If they're ordering, you can offer it like a regular's order ("the usual ${title(usual[0].name).toLowerCase()}?"), but don't push it.`);
    else if (orders.length) about.push(`They've ordered from us ${orders.length} time${orders.length > 1 ? 's' : ''} before.`);
    const open = orders.find((o) => o && !['collected', 'delivered', 'served', 'cancelled'].includes(o.status));
    if (open) about.push(`They have an order in progress right now: #${open.number}. If they ask about it, use check_order.`);
  } catch {}
  const club = normaliseClub(user.club);
  if (club.member) {
    const left = CLUB.stampsPerReward - club.stamps;
    about.push(club.rewards > 0 ? `brewns Club: they have ${club.rewards} free drink${club.rewards > 1 ? 's' : ''} waiting. Mention it if they order a drink.` : `brewns Club: ${club.stamps} stamps, ${left} more for a free drink.`);
  }
  about.push("Never read their mobile number back unless they ask, and don't recite all of this; use it the way a barista who knows them would.");
  lines.unshift(...about);
  return { userId: user.id, firstName, phone: user.phone || undefined, soldOut, note: `\n\nAbout this caller and today:\n- ${lines.join('\n- ')}` };
}
