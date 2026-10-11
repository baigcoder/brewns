import { homeFor, permsFor, type Role } from '@/lib/rbac';
import { findByEmail, findCustomerByPhone, startSession, verifyPassword } from '@/lib/server/auth';
import { audit, securityOnce } from '@/lib/server/audit';
import { checkSecondFactor } from '@/lib/server/twostep';
import { clientIp, fail, json, normEmail, rateLimit, readBody, route, str } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';
import { pkMobile } from '@/lib/catalog';

/** "sara@brewns.test" becomes "s***@brewns.test": enough to recognise, not enough to harvest. */
const maskEmail = (v: string) => (v.includes('@') ? `${v[0]}***${v.slice(v.indexOf('@'))}` : `${v.slice(0, 1)}***`);

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
  if (process.env.NODE_ENV === 'production') {
    await rateLimit(`signin:${clientIp(req)}`, 30, 900);
    try {
      await rateLimit(`signin:${kind}:${login.toLowerCase()}`, 8, 900, 'Too many tries for this account. Wait 15 minutes, or ask the owner to send a new link.');
    } catch (e) {
      if (kind === 'staff') await securityOnce(`lock:${login.toLowerCase()}`, 900, null, 'Sign-in locked after too many tries', maskEmail(login));
      throw e;
    }
  }

  const phone = kind === 'customer' && !login.includes('@') ? pkMobile(login) : '';
  const user = phone ? await findCustomerByPhone(phone) : await findByEmail(kind, normEmail(login));
  const ok = await verifyPassword(password, user?.passHash ?? null);
  if (!user || !ok) {
    if (user && kind === 'staff' && user.passHash)
      await securityOnce(`fail:${user.id}`, 60, { id: user.id, name: user.name, role: String(user.role) }, 'Failed sign-in: wrong password');
    if (user?.invite && !user.passHash) fail(401, 'Your account is waiting for you to set a password: open the invite link the owner sent you.');
    fail(401, kind === 'staff' ? "That email and password don't match." : "That login and password don't match.");
  }
  if (!user!.active) {
    const waiting = user!.invitedBy === 'Self sign-up' && !user!.lastLoginAt;
    fail(403, kind === 'staff' ? (waiting ? "Your account is waiting for the owner or a manager to approve it. They'll switch it on from Team." : 'This account is switched off. Ask the owner or a manager.') : 'This account is closed.');
  }

  let how: 'app' | 'recovery' | null = null;
  if (kind === 'staff' && user!.totp?.on) {
    const code = str(b.code, 24);
    // The password was right; now the code. The form shows its code box when it hears this.
    if (!code) return json({ needsCode: true });
    if (process.env.NODE_ENV === 'production') await rateLimit(`2fa:${user!.id}`, 8, 900, 'Too many wrong codes. Wait 15 minutes, or ask the owner to reset two-step sign-in.');
    how = await checkSecondFactor(user!, code);
    if (!how) {
      await securityOnce(`code:${user!.id}`, 60, { id: user!.id, name: user!.name, role: String(user!.role) }, 'Failed sign-in: wrong two-step code');
      fail(401, "That code isn't right. Check your authenticator app (it changes every 30 seconds), or use a recovery code.");
    }
  }

  await startSession(user!);
  if (kind === 'staff') {
    const settings = await getSettings();
    const role = user!.role as Role; // a staff account never has the customer role
    const actor = { id: user!.id, name: user!.name, role };
    await audit(actor, how === 'recovery' ? 'Signed in with a recovery code' : 'Signed in', how === 'recovery' ? `${user!.totp?.recovery.length ?? 0} recovery codes left` : how ? 'Two-step code' : '', 'security');
    return json({ ok: true, next: safeNext(b.next, homeFor(role, permsFor(role, settings.rolePerms))) });
  }
  return json({ ok: true, next: safeNext(b.next, '/account') });
});
