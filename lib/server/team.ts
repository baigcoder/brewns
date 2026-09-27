/* The team: inviting people, changing their role or shops, switching accounts
   off. The rules that keep access control honest live here:
   - you can only invite or change people below your own role (owners: anyone),
     and only give a role below yours (owners can make other owners);
   - you can't change your own role or switch yourself off;
   - the café always keeps at least one active owner;
   - a manager tied to some shops can only hand out those shops. */

import { ROLES, outranks, ROLE_INFO, type Role } from '@/lib/rbac';
import { SHOP_COUNT, LOC_TITLES } from '@/lib/catalog';
import { audit } from './audit';
import { allUsers, findByEmail, getUser, newUser, publicUser, randomToken, saveUser, sha256, type StaffContext, type User } from './auth';
import { fail, isEmail, normEmail, str } from './http';
import { kv, withLock } from './store';

const INVITE_DAYS = 7;

const cleanShops = (ctx: StaffContext, raw: unknown) => {
  const shops = Array.isArray(raw) ? [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < SHOP_COUNT))].sort() : [];
  const mine = ctx.user.shops;
  if (mine.length) {
    if (!shops.length) return mine; // "all shops" from a manager tied to some means theirs
    if (shops.some((s) => !mine.includes(s))) fail(403, `You can only give out shops you work at: ${mine.map((s) => LOC_TITLES[s]).join(', ')}.`);
  }
  return shops;
};

const cleanRole = (ctx: StaffContext, raw: unknown): Role => {
  const role = String(raw) as Role;
  if (!ROLES.includes(role)) fail(400, 'Pick a role.');
  if (!outranks(ctx.role, role) && !(ctx.role === 'owner' && role === 'owner')) fail(403, `A ${ROLE_INFO[ctx.role].label.toLowerCase()} can't give the ${ROLE_INFO[role].label.toLowerCase()} role.`);
  return role;
};

const inviteFor = () => {
  const token = randomToken(24);
  return { token, invite: { hash: sha256(token), exp: Date.now() + INVITE_DAYS * 86400000 } };
};

const actorOf = (ctx: StaffContext) => ({ id: ctx.user.id, name: ctx.user.name, role: ctx.role });

export const listTeam = async () => (await allUsers('staff')).sort((a, b) => a.createdAt - b.createdAt).map(publicUser);

export async function invite(ctx: StaffContext, b: Record<string, unknown>) {
  const name = str(b.name, 60).replace(/\s+/g, ' ');
  const email = normEmail(b.email);
  if (name.length < 2) fail(400, 'Add their name.');
  if (!isEmail(email)) fail(400, 'That email looks off.');
  const role = cleanRole(ctx, b.role);
  const shops = cleanShops(ctx, b.shops);
  return withLock('team', async () => {
    if (await findByEmail('staff', email)) fail(409, 'Someone on the team already uses that email.');
    const { token, invite } = inviteFor();
    const user = newUser({ kind: 'staff', role, name, email, phone: str(b.phone, 20), plate: str(b.plate, 20).toUpperCase(), shops, invite, invitedBy: ctx.user.name });
    await saveUser(user);
    await audit(actorOf(ctx), `Invited ${name} as ${ROLE_INFO[role].label.toLowerCase()}`, shops.length ? shops.map((s) => LOC_TITLES[s]).join(', ') : 'All shops');
    return { user: publicUser(user), token };
  });
}

const activeOwners = async () => (await allUsers('staff')).filter((u) => u.role === 'owner' && u.active);

/** `{ role?, shops?, name?, phone?, plate?, active?, reset?, signout?, remove? }` */
export async function editMember(ctx: StaffContext, id: string, b: Record<string, unknown>) {
  return withLock('team', async () => {
    const target = await getUser(id);
    if (!target || target.kind !== 'staff' || target.role === 'customer') return fail(404, 'No such team member.') as never;
    const self = target.id === ctx.user.id;
    if (!self && !outranks(ctx.role, target.role)) fail(403, `Only someone above a ${ROLE_INFO[target.role].label.toLowerCase()} can change their account.`);
    const next: User = { ...target };
    const done: string[] = [];
    let token = '';

    if (b.remove) {
      if (target.passHash) fail(409, 'They have already joined. Switch the account off instead, so their history stays.');
      await kv.hdel('users', target.id);
      await kv.hdel('idx:staff-email', target.email);
      await audit(actorOf(ctx), `Withdrew the invite for ${target.name}`);
      return { user: null, token: '' };
    }
    if (b.role !== undefined && b.role !== target.role) {
      if (self) fail(403, "You can't change your own role. Ask another owner.");
      const role = cleanRole(ctx, b.role);
      if (target.role === 'owner' && (await activeOwners()).length < 2) fail(409, 'The café needs at least one owner. Make someone else an owner first.');
      next.role = role;
      next.v += 1; // their screens reload with the new role
      done.push(`role → ${ROLE_INFO[role].label.toLowerCase()}`);
    }
    if (b.shops !== undefined) {
      if (self && ctx.role !== 'owner') fail(403, "You can't change your own shops.");
      next.shops = cleanShops(ctx, b.shops);
      done.push(`shops → ${next.shops.length ? next.shops.map((s) => LOC_TITLES[s]).join(', ') : 'all'}`);
    }
    if (b.name !== undefined) {
      const name = str(b.name, 60).replace(/\s+/g, ' ');
      if (name.length < 2) fail(400, 'Add their name.');
      next.name = name;
    }
    if (b.phone !== undefined) next.phone = str(b.phone, 20);
    if (b.plate !== undefined) next.plate = str(b.plate, 20).toUpperCase();
    if (b.active !== undefined && !!b.active !== target.active) {
      if (self) fail(403, "You can't switch off your own account.");
      if (!b.active && target.role === 'owner' && (await activeOwners()).length < 2) fail(409, 'The café needs at least one active owner.');
      next.active = !!b.active;
      next.v += 1;
      done.push(next.active ? 'switched on' : 'switched off');
    }
    if (b.signout) {
      next.v += 1;
      done.push('signed out everywhere');
    }
    if (b.reset) {
      if (!next.active) fail(409, 'Switch the account on first.');
      const fresh = inviteFor();
      token = fresh.token;
      next.invite = fresh.invite;
      done.push(target.passHash ? 'new password link' : 'new invite link');
    }
    await saveUser(next, target);
    if (done.length) await audit(actorOf(ctx), `${target.name}: ${done.join(', ')}`);
    return { user: publicUser(next), token };
  });
}
