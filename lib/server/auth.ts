/* Accounts and sessions.

   Passwords are hashed with scrypt (Node's crypto, no library). A session is a
   signed, httpOnly cookie holding the account id and its session version;
   every request loads the account again, so deactivating someone, changing
   their role or "sign out everywhere" (which bumps the version) takes effect
   on their very next click. Staff and customers have separate cookies, so the
   same person can be a barista at work and a club member at home. */

import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ClubState } from '@/components/brewns/club';
import { canOpen, permsFor, sectionByKey, type AccountKind, type Permission, type Role } from '@/lib/rbac';
import { securityOnce } from './audit';
import { fail } from './http';
import { getSettings, type Settings } from './settings';
import { kv } from './store';

/* ── passwords and tokens ── */

const scrypt = (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, len, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? rej(err) : res(key))));

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const key = await scrypt(pw, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(pw: string, stored: string | null) {
  // Hash something even without an account, so a missing email takes as long as a wrong password.
  const [alg, N, r, p, salt, hash] = (stored || 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$').split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64url');
  const got = await scrypt(pw, Buffer.from(salt, 'base64url'), want.length || 64, { N: +N, r: +r, p: +p });
  return !!stored && want.length === got.length && timingSafeEqual(want, got);
}

export const passwordProblem = (pw: string) =>
  pw.length < 8 ? 'Use at least 8 characters.' : pw.length > 200 ? 'That password is too long.' : !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw) ? 'Mix letters and at least one number.' : '';

export const randomToken = (bytes = 24) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('base64url');
export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString('base64url')}`;

let secretCache = '';
async function secret() {
  if (secretCache) return secretCache;
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 16) return (secretCache = env);
  // No secret set: make one and keep it with the data, so every server instance signs alike.
  await kv.set('secret:session', randomToken(32), { nx: true });
  return (secretCache = (await kv.get<string>('secret:session')) || '');
}

const sign = async (payload: string) => createHmac('sha256', await secret()).update(payload).digest('base64url');

/** A short signature of `text` for one `purpose` (a table's QR code, say), made with the server secret: nobody can produce one without it. */
export const signText = async (purpose: string, text: string) => (await sign(`${purpose}:${text}`)).slice(0, 16);

/** Encrypts a small value (AES-256-GCM) with a key derived from the server secret, for things we must be able to read back, like a two-step secret. */
export async function seal(plain: string) {
  const key = createHmac('sha256', await secret()).update('seal-v1').digest();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** The value `seal` made, or null if it was tampered with or the secret changed. */
export async function unseal(token: string): Promise<string | null> {
  try {
    const [v, iv, tag, ct] = token.split('.');
    if (v !== 'v1') return null;
    const key = createHmac('sha256', await secret()).update('seal-v1').digest();
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/* ── accounts ── */

/** Two-step sign-in. `enc` is the sealed secret; `on` is false while someone is still setting it up. */
export type TotpState = {
  enc: string;
  on: boolean;
  since: number;
  /** The last time-step accepted, so one code cannot be used twice. */
  last: number;
  /** Hashes of the recovery codes still unused. */
  recovery: string[];
};

export type User = {
  id: string;
  kind: AccountKind;
  role: Role | 'customer';
  name: string;
  email: string;
  phone: string;
  /** A rider's bike, shown to the customer. */
  plate: string;
  /** Shops this person works at, by index. Empty: all of them. */
  shops: number[];
  passHash: string | null;
  active: boolean;
  createdAt: number;
  lastLoginAt: number;
  lastSeenAt: number;
  /** Session version: bump it and every open session of this account ends. */
  v: number;
  invite: { hash: string; exp: number } | null;
  invitedBy: string;
  club: ClubState | null;
  clubImported: boolean;
  totp?: TotpState | null;
};

export type PublicUser = Omit<User, 'passHash' | 'invite' | 'club' | 'totp'> & { invited: boolean; inviteExpired: boolean; twoStep: boolean; recoveryLeft: number };

export const publicUser = ({ passHash: _p, invite, club: _c, totp, ...u }: User): PublicUser => ({
  ...u,
  invited: !!invite,
  inviteExpired: !!invite && invite.exp < Date.now(),
  twoStep: !!totp?.on,
  recoveryLeft: totp?.on ? totp.recovery.length : 0,
});

const emailIndex = (kind: AccountKind) => (kind === 'staff' ? 'idx:staff-email' : 'idx:customer-email');

export const getUser = (id: string) => kv.hget<User>('users', id);
/** Everyone, with the freshest "last seen" laid over (it is kept apart from the account, see `currentStaff`). */
export const allUsers = async (kind?: AccountKind) => {
  const [users, seen] = await Promise.all([kv.hall<User>('users'), kv.hall<number>('seen')]);
  return Object.values(users)
    .filter((u) => !kind || u.kind === kind)
    .map((u) => (seen[u.id] > u.lastSeenAt ? { ...u, lastSeenAt: seen[u.id] } : u));
};

export async function findByEmail(kind: AccountKind, email: string) {
  const id = await kv.hget<string>(emailIndex(kind), email.toLowerCase());
  return id ? getUser(id) : null;
}
export async function findCustomerByPhone(phone: string) {
  const id = await kv.hget<string>('idx:customer-phone', phone.replace(/\D/g, ''));
  return id ? getUser(id) : null;
}

export async function saveUser(u: User, prev?: User | null) {
  if (prev && prev.email !== u.email) await kv.hdel(emailIndex(u.kind), prev.email);
  if (prev && u.kind === 'customer' && prev.phone !== u.phone && prev.phone) await kv.hdel('idx:customer-phone', prev.phone.replace(/\D/g, ''));
  await kv.hset('users', u.id, u);
  if (u.email) await kv.hset(emailIndex(u.kind), u.email, u.id);
  if (u.kind === 'customer' && u.phone) await kv.hset('idx:customer-phone', u.phone.replace(/\D/g, ''), u.id);
  return u;
}

export const newUser = (fields: Partial<User> & Pick<User, 'kind' | 'role' | 'name' | 'email'>): User => ({
  id: newId(fields.kind === 'staff' ? 'st' : 'cu'),
  phone: '',
  plate: '',
  shops: [],
  passHash: null,
  active: true,
  createdAt: Date.now(),
  lastLoginAt: 0,
  lastSeenAt: 0,
  v: 1,
  invite: null,
  invitedBy: '',
  club: null,
  clubImported: false,
  ...fields,
});

/** Has the café been set up? Remembered once true (the last owner can't be removed), so the site's status check stays one read. */
export async function ownerExists() {
  if (await kv.get<boolean>('meta:owner')) return true;
  const yes = (await allUsers('staff')).some((u) => u.role === 'owner' && u.active);
  if (yes) await kv.set('meta:owner', true);
  return yes;
}

/* ── sessions ── */

export const STAFF_COOKIE = 'brewns_staff';
export const CUSTOMER_COOKIE = 'brewns_customer';
const cookieFor = (kind: AccountKind) => (kind === 'staff' ? STAFF_COOKIE : CUSTOMER_COOKIE);
const LIFETIME = { staff: 7 * 86400, customer: 60 * 86400 };

type Claims = { u: string; v: number; e: number };

export async function startSession(u: User) {
  const claims: Claims = { u: u.id, v: u.v, e: Date.now() + LIFETIME[u.kind] * 1000 };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  (await cookies()).set(cookieFor(u.kind), `${payload}.${await sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LIFETIME[u.kind],
  });
  u.lastLoginAt = Date.now();
  await saveUser(u);
}

export async function endSession(kind: AccountKind) {
  (await cookies()).delete(cookieFor(kind));
}

async function readSession(kind: AccountKind): Promise<User | null> {
  const raw = (await cookies()).get(cookieFor(kind))?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(await sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
  if (!claims.e || claims.e < Date.now()) return null;
  const u = await getUser(claims.u);
  if (!u || u.kind !== kind || !u.active || u.v !== claims.v) return null;
  return u;
}

export type StaffContext = { user: User; role: Role; perms: Permission[]; settings: Settings };

const touched = new Map<string, number>();

/** The signed-in staff member with their permissions, or null. Notes when they were last seen (at most once a minute). */
export async function currentStaff(): Promise<StaffContext | null> {
  const user = await readSession('staff');
  if (!user || user.role === 'customer') return null;
  const settings = await getSettings();
  // Written to its own hash, never back onto the account: saving the copy loaded at the start of a request
  // could undo a change made meanwhile (a deactivation, a new role, "sign out everywhere").
  const now = Date.now();
  if (now - (touched.get(user.id) || 0) > 60000) {
    touched.set(user.id, now);
    await kv.hset('seen', user.id, now);
  }
  return { user, role: user.role, perms: permsFor(user.role, settings.rolePerms), settings };
}

export const currentCustomer = () => readSession('customer');

/** For API routes: the staff member, who must hold every permission listed (or at least one, with `any`). */
export async function requireStaff(need: Permission[] = [], mode: 'all' | 'any' = 'all') {
  const ctx = await currentStaff();
  if (!ctx) return fail(401, 'Sign in again.') as never;
  const ok = !need.length || (mode === 'all' ? need.every((p) => ctx.perms.includes(p)) : need.some((p) => ctx.perms.includes(p)));
  if (!ok) {
    await securityOnce(`deny:${ctx.user.id}:${need.join(',')}`, 300, { id: ctx.user.id, name: ctx.user.name, role: ctx.role }, 'Blocked: tried something their role does not allow', `Needed ${mode === 'any' ? 'one of' : 'all of'}: ${need.join(', ')}`);
    return fail(403, "Your role doesn't allow that. Ask the owner if you need it.") as never;
  }
  return ctx;
}

export async function requireCustomer() {
  return (await currentCustomer()) || (fail(401, 'Sign in again.') as never);
}

/** For console pages: signed in and allowed on this screen, or sent where they can go. */
export async function staffPage(sectionKey: string) {
  const ctx = await currentStaff();
  const section = sectionByKey(sectionKey);
  if (!ctx) redirect(`/staff/signin?next=${encodeURIComponent(section?.href || '/dashboard')}`);
  if (section && !canOpen(ctx.perms, section)) redirect('/dashboard?denied=' + encodeURIComponent(section.label));
  return ctx;
}

/** Can this person see or act on orders at shop `loc`? */
export const worksAt = (u: Pick<User, 'shops'>, loc: number) => !u.shops.length || u.shops.includes(loc);

/** Removes an account and its sign-in lookups. Orders and history are the caller's job to deal with first. */
export async function deleteUser(u: User) {
  await kv.hdel('users', u.id);
  await kv.hdel('seen', u.id);
  if (u.email) await kv.hdel(emailIndex(u.kind), u.email);
  if (u.kind === 'customer' && u.phone) await kv.hdel('idx:customer-phone', u.phone.replace(/\D/g, ''));
}
