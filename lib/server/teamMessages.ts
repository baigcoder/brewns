/* Messages to the team: an owner or manager writes once, everyone on the team sees it in the
   console (with an unread count in the menu), and can be emailed a copy.

   team:messages      newest first, the last 200
   team:read:<uid>    when that person last opened the messages */

import { ROLE_INFO, type Role } from '@/lib/rbac';
import { SITE_URL } from '@/lib/site';
import { audit } from './audit';
import { allUsers, randomToken, type StaffContext, type User } from './auth';
import { renderLinkEmail, sendEmail } from './email';
import { fail } from './http';
import { bumpLive } from './orders';
import { kv } from './store';

export type TeamMessage = {
  id: string;
  text: string;
  by: string;
  byId: string;
  role: string;
  at: number;
  /** The shops it is for; empty: everyone. A manager tied to some shops writes to those shops' people. */
  shops: number[];
  emailed: number;
};

const KEY = 'team:messages';
const readKey = (uid: string) => `team:read:${uid}`;
export const MAX_TEXT = 1000;

/** Is this message for this person? Someone at every shop sees everything; otherwise it must be for a shop they work at. */
export const isFor = (m: Pick<TeamMessage, 'shops'>, u: Pick<User, 'shops'>) => !m.shops.length || !u.shops.length || m.shops.some((s) => u.shops.includes(s));

/** What a team member sees: the latest 50 messages for them, and how many arrived since they last looked. */
export async function messagesFor(u: User) {
  const [all, seen] = await Promise.all([kv.list<TeamMessage>(KEY), kv.num(readKey(u.id))]);
  const mine = all.filter((m) => isFor(m, u));
  return { messages: mine.slice(0, 50), unread: mine.filter((m) => m.at > seen && m.byId !== u.id).length };
}

export const unreadFor = async (u: User) => (await messagesFor(u)).unread;

export async function markRead(u: User) {
  await kv.set(readKey(u.id), Date.now());
  await bumpLive(); // the menu badge on their other screens clears too
}

/** Sends a message to the team. Who may is checked by the route (staff.manage). */
export async function postMessage(ctx: StaffContext, b: { text?: unknown; email?: unknown }) {
  const text = String(b.text ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
  if (text.length < 2) fail(400, 'Write the message first.');
  const shops = ctx.role === 'owner' ? [] : ctx.user.shops;
  const msg: TeamMessage = { id: randomToken(6), text, by: ctx.user.name, byId: ctx.user.id, role: ctx.role, at: Date.now(), shops, emailed: 0 };

  if (b.email === true) {
    const people = (await allUsers('staff')).filter((u) => u.id !== ctx.user.id && u.active && u.passHash && u.role !== 'customer' && isFor(msg, u));
    const link = `${SITE_URL}/dashboard/messages`;
    const from = `${ctx.user.name} (${ROLE_INFO[ctx.role as Role]?.label || ctx.role})`;
    for (const u of people.slice(0, 200)) {
      const sent = await sendEmail({
        to: u.email,
        subject: `brewns · a message from ${ctx.user.name}`,
        text: `Hi ${u.name.split(' ')[0]},\n\n${text}\n\n${from}\n\nSee all team messages: ${link}`,
        html: renderLinkEmail({
          preview: text.slice(0, 120),
          heading: `A message from ${ctx.user.name}`,
          lines: [`Hi ${u.name.split(' ')[0]},`, ...text.split('\n').filter(Boolean)],
          button: 'Open team messages',
          link,
          note: 'Sent to the brewns team. Reply in person or on the team chat.',
          signoff: `${from}, brewns coffee house`,
        }),
      }).catch(() => ({ ok: false }));
      if (sent.ok) msg.emailed++;
    }
  }

  await kv.push(KEY, msg, 200);
  await bumpLive();
  await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, 'Sent a message to the team', `${text.slice(0, 80)}${msg.emailed ? ` · emailed ${msg.emailed}` : ''}`);
  return msg;
}
