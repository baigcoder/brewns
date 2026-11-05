/* One-to-one messages between two staff members who share a shop.

   dm:<a>:<b>        the conversation (ids sorted), newest first, the last 200
   dm:threads:<uid>  that person's conversations: other id → the latest line and how many they haven't read */

import { ROLE_INFO, type Role } from '@/lib/rbac';
import { allUsers, getUser, randomToken, type StaffContext, type User } from './auth';
import { fail } from './http';
import { bumpLive } from './orders';
import { kv, withLock } from './store';
import { isFor } from './teamMessages';

export type DirectMessage = { id: string; byId: string; text: string; at: number };
export type DmThread = { with: string; name: string; last: string; at: number; byId: string; unread: number };

const MAX_TEXT = 1000;
const convKey = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`;
const threadsKey = (uid: string) => `dm:threads:${uid}`;

/** Staff can write to each other when they share a shop (someone at every shop reaches everyone). */
const reachable = (me: Pick<User, 'id' | 'shops'>, u: User) => u.id !== me.id && u.kind === 'staff' && u.active && u.role !== 'customer' && isFor({ shops: u.shops }, me);

/** Who this person can open a conversation with. */
export async function dmContacts(me: User) {
  return (await allUsers('staff'))
    .filter((u) => reachable(me, u))
    .map((u) => ({ id: u.id, name: u.name, role: ROLE_INFO[u.role as Role]?.label || u.role, shops: u.shops }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Their conversations, latest first. */
export async function dmThreads(me: User) {
  return Object.values(await kv.hall<DmThread>(threadsKey(me.id))).sort((a, b) => b.at - a.at);
}

/** One conversation, oldest first; opening it reads it. */
export async function dmConversation(me: User, other: string) {
  const messages = (await kv.list<DirectMessage>(convKey(me.id, other), 0, 99)).reverse();
  const cleared = await withLock(convKey(me.id, other), async () => {
    const t = await kv.hget<DmThread>(threadsKey(me.id), other);
    if (t?.unread) await kv.hset(threadsKey(me.id), other, { ...t, unread: 0 });
    return !!t?.unread;
  });
  // Only bump when something changed, or the screen that refetches on every bump would loop.
  if (cleared) await bumpLive();
  return messages;
}

export async function sendDm(ctx: StaffContext, b: { to?: unknown; text?: unknown }) {
  const text = String(b.text ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
  if (!text) fail(400, 'Write the message first.');
  const to = await getUser(String(b.to ?? ''));
  if (!to || !reachable(ctx.user, to)) fail(404, 'You can only message people at your shops.');
  const msg: DirectMessage = { id: randomToken(6), byId: ctx.user.id, text, at: Date.now() };
  await withLock(convKey(ctx.user.id, to!.id), async () => {
    const theirs = await kv.hget<DmThread>(threadsKey(to!.id), ctx.user.id);
    const line = { last: text.slice(0, 120), at: msg.at, byId: ctx.user.id };
    await kv.push(convKey(ctx.user.id, to!.id), msg, 200);
    await kv.hset(threadsKey(ctx.user.id), to!.id, { with: to!.id, name: to!.name, ...line, unread: 0 });
    await kv.hset(threadsKey(to!.id), ctx.user.id, { with: ctx.user.id, name: ctx.user.name, ...line, unread: (theirs?.unread || 0) + 1 });
  });
  await bumpLive();
  return msg;
}
