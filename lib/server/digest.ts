/* The owner's end-of-day email: how the day went, without opening the console.

   It is sent once a day by the scheduled job (/api/cron/daily) to every active owner who
   has an email, unless the owner switched it off on the Shops page. A day with no orders
   sends nothing, so closed days don't fill an inbox. */

import { LOC_TITLES } from '@/lib/catalog';
import { pkDay } from '@/lib/orderFlow';
import { permsFor } from '@/lib/rbac';
import { SITE_URL } from '@/lib/site';
import { allUsers, type StaffContext } from './auth';
import { sendEmail } from './email';
import { report } from './reports';
import { getSettings, type Settings } from './settings';
import { kv } from './store';

type Kpis = { gross: number; net: number; orders: number; avg: number; cancelled: number; refundsPending: number; unpaid: number; prepMin: number; onTimePct: number };
export type DigestInput = {
  day: string;
  kpis: Kpis;
  prev: Pick<Kpis, 'gross' | 'orders'>;
  top: { name: string; qty: number }[];
  byShop: ({ loc: number } & Pick<Kpis, 'gross' | 'orders'>)[];
};

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

/** The email for a day's numbers, or null when there is nothing to report. */
export function digestMessage(d: DigestInput): { subject: string; text: string } | null {
  const k = d.kpis;
  if (!k.orders && !k.cancelled) return null;
  const date = new Date(`${d.day}T12:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' });
  const vs = d.prev.gross > 0 ? ` (${k.gross >= d.prev.gross ? 'up' : 'down'} ${Math.round((Math.abs(k.gross - d.prev.gross) / d.prev.gross) * 100)}% on the same day last week, ${rs(d.prev.gross)})` : '';
  const lines = [
    `How ${date} went at brewns:`,
    '',
    `Sales ${rs(k.gross)}${vs}`,
    `${k.orders} order${k.orders === 1 ? '' : 's'}, ${rs(k.avg)} on average. After tax, delivery fees and refunds you kept ${rs(k.net)}.`,
  ];
  if (k.onTimePct) lines.push(`${Math.round(k.onTimePct)}% on time, about ${Math.round(k.prepMin)} minutes from order to ready.`);
  const watch: string[] = [];
  if (k.cancelled) watch.push(`${k.cancelled} cancelled`);
  if (k.refundsPending) watch.push(`${rs(k.refundsPending)} in refunds still to send`);
  if (k.unpaid) watch.push(`${rs(k.unpaid)} not yet marked paid`);
  if (watch.length) lines.push('', `Needs a look: ${watch.join(', ')}.`);
  if (d.top.length) lines.push('', 'Best sellers:', ...d.top.slice(0, 3).map((t, i) => `${i + 1}. ${t.name}: ${t.qty}`));
  const shops = d.byShop.filter((s) => s.orders > 0);
  if (shops.length > 1) lines.push('', 'By shop:', ...shops.map((s) => `${LOC_TITLES[s.loc]}: ${rs(s.gross)} from ${s.orders} order${s.orders === 1 ? '' : 's'}`));
  lines.push('', `Everything, with the hourly chart: ${SITE_URL}/dashboard/overview`, '', "You get this every evening. Switch it off any time under Shops in the console.");
  return { subject: `brewns · ${date}: ${rs(k.gross)} from ${k.orders} order${k.orders === 1 ? '' : 's'}`, text: lines.join('\n') };
}

/** Sends today's summary to the owners. Safe to run twice in a day: it sends once. */
export async function sendDailyDigest(): Promise<{ sent: number; skipped: string }> {
  const settings = await getSettings();
  if (!settings.digest) return { sent: 0, skipped: 'switched off' };
  const day = pkDay(Date.now());
  if (!(await kv.set(`digest:${day}`, 1, { nx: true, ttlSec: 36 * 3600 }))) return { sent: 0, skipped: 'already sent today' };
  // The day only counts as done once someone was actually emailed; any other outcome leaves it free for a later run.
  const result = await send(settings);
  if (!result.sent) await kv.del(`digest:${day}`);
  return result;
}

async function send(settings: Settings): Promise<{ sent: number; skipped: string }> {
  const owners = (await allUsers('staff')).filter((u) => u.role === 'owner' && u.active && u.email);
  if (!owners.length) return { sent: 0, skipped: 'no owner with an email' };
  const ctx: StaffContext = { user: owners[0], role: 'owner', perms: permsFor('owner', settings.rolePerms), settings };
  const r = await report('today', ctx);
  if (r.demo) return { sent: 0, skipped: 'demo data' };
  const msg = digestMessage({ day: pkDay(Date.now()), kpis: r.kpis, prev: r.prev, top: r.top, byShop: r.byShop });
  if (!msg) return { sent: 0, skipped: 'no orders today' };
  let sent = 0;
  for (const o of owners) if ((await sendEmail({ to: o.email, subject: msg.subject, text: msg.text })).ok) sent++;
  return { sent, skipped: sent ? '' : 'no email service is set up' };
}
