import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb, mutateDb, type StaffUser, type CustomerUser, type Session } from './storage';
import { can, canAny, type Permission, effectivePermsFor, hasShopScope } from '../rbac';

export const STAFF_COOKIE_NAME = 'brewns_staff_session';
export const CUST_COOKIE_NAME = 'brewns_cust_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createStaffSession(userId: string): Session {
  const token = createSessionToken();
  const db = getDb();
  const user = db.staff[userId];
  const expiresAt = Date.now() + SESSION_TTL_MS;

  const session: Session = {
    token,
    userId,
    kind: 'staff',
    role: user?.role,
    expiresAt,
  };

  mutateDb((d) => {
    d.sessions[token] = session;
  });

  return session;
}

export function createCustomerSession(userId: string): Session {
  const token = createSessionToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  const session: Session = {
    token,
    userId,
    kind: 'customer',
    expiresAt,
  };

  mutateDb((d) => {
    d.sessions[token] = session;
  });

  return session;
}

export function deleteSession(token: string): void {
  mutateDb((d) => {
    delete d.sessions[token];
  });
}

/** Immediately invalidate all active sessions for a staff member (kill-switch) */
export function revokeStaffSessions(userId: string): void {
  mutateDb((d) => {
    for (const [token, sess] of Object.entries(d.sessions)) {
      if (sess.userId === userId) {
        delete d.sessions[token];
      }
    }
  });
}

export type StaffAuthContext = {
  user: StaffUser;
  perms: Permission[];
  session: Session;
};

export async function getCurrentStaff(): Promise<StaffAuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const session = db.sessions[token];
  if (!session || session.kind !== 'staff' || session.expiresAt < Date.now()) {
    return null;
  }

  const user = db.staff[session.userId];
  if (!user || !user.active) return null;

  // Real-time dynamic evaluation: base role perms + custom grants - custom denies
  const perms = effectivePermsFor(user, db.rolePerms);
  return { user, perms, session };
}

export async function getCurrentCustomer(): Promise<{ user: CustomerUser; session: Session } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUST_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const session = db.sessions[token];
  if (!session || session.kind !== 'customer' || session.expiresAt < Date.now()) {
    return null;
  }

  const user = db.customers[session.userId];
  if (!user) return null;

  return { user, session };
}

export function assertPerm(perms: readonly string[], ...need: Permission[]): boolean {
  return can(perms, ...need);
}

export function assertAnyPerm(perms: readonly string[], ...need: Permission[]): boolean {
  return canAny(perms, ...need);
}

export function assertShopScope(user: StaffUser, shopId: number): boolean {
  return hasShopScope(user, shopId);
}
