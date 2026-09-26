import { homeFor, permsFor, type Role } from '@/lib/rbac';
import { findByEmail, findCustomerByPhone, startSession, verifyPassword } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clientIp, fail, json, normEmail, rateLimit, readBody, route, str } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';
import { pkMobile } from '@/lib/catalog';

const safeNext = (v: unknown, fallback: string) => {
  const n = str(v, 300);
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/api/') ? n : fallback;
};

/** Staff (email) or customer (email or mobile) sign-in. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  const kind = b.kind === 'customer' ? 'customer' : 'staff';
  const login = str(b.email, 120);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!login || !password) fail(400, 'Enter your email and password.');
  await rateLimit(`signin:${clientIp(req)}`, 30, 900);
  await rateLimit(`signin:${kind}:${login.toLowerCase()}`, 8, 900, 'Too many tries for this account. Wait 15 minutes, or ask the owner to send a new link.');

  const phone = kind === 'customer' && !login.includes('@') ? pkMobile(login) : '';
  const user = phone ? await findCustomerByPhone(phone) : await findByEmail(kind, normEmail(login));
  const ok = await verifyPassword(password, user?.passHash ?? null);
  if (!user || !ok) {
    if (user?.invite && !user.passHash) fail(401, 'Your account is waiting for you to set a password: open the invite link the owner sent you.');
    fail(401, kind === 'staff' ? "That email and password don't match." : "That login and password don't match.");
  }
  if (!user!.active) fail(403, kind === 'staff' ? 'This account is switched off. Ask the owner or a manager.' : 'This account is closed.');

  await startSession(user!);
  if (kind === 'staff') {
    const settings = await getSettings();
    const role = user!.role as Role; // a staff account never has the customer role
    await audit({ id: user!.id, name: user!.name, role }, 'Signed in');
    return json({ ok: true, next: safeNext(b.next, homeFor(role, permsFor(role, settings.rolePerms))) });
  }
  return json({ ok: true, next: safeNext(b.next, '/account') });
});
