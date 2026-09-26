import { homeFor, permsFor, type Role } from '@/lib/rbac';
import { allUsers, hashPassword, passwordProblem, saveUser, sha256, startSession } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clientIp, fail, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';

/** Accepts an invite (or a password reset link): sets the password and signs in. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  await rateLimit(`invite:${clientIp(req)}`, 20, 900);
  const token = str(b.token, 100);
  const password = typeof b.password === 'string' ? b.password : '';
  const hash = sha256(token);
  const user = token ? (await allUsers('staff')).find((u) => u.invite?.hash === hash) : null;
  if (!user || user.role === 'customer') return fail(404, 'This link has already been used or was replaced by a newer one. Ask for a new link.');
  if (user.invite!.exp < Date.now()) fail(410, 'This link has expired. Ask the owner or a manager for a new one.');
  if (!user.active) fail(403, 'This account is switched off.');
  const weak = passwordProblem(password);
  if (weak) fail(400, weak);
  const name = str(b.name, 60).replace(/\s+/g, ' ');
  const next = { ...user, name: name.length >= 2 ? name : user.name, passHash: await hashPassword(password), invite: null, v: user.v + 1 };
  await saveUser(next);
  await startSession(next);
  await audit({ id: next.id, name: next.name, role: next.role }, user.passHash ? 'Reset their password' : 'Joined the team');
  const settings = await getSettings();
  const role = next.role as Role; // staff accounts only, checked above
  return json({ ok: true, next: homeFor(role, permsFor(role, settings.rolePerms)) });
});
