import { hashPassword, newUser, ownerExists, passwordProblem, saveUser, startSession } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clientIp, fail, isEmail, json, normEmail, rateLimit, readBody, route, str } from '@/lib/server/http';
import { withLock } from '@/lib/server/store';

/** The first owner. After that, owners and staff join by invitation from the Team page. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  await rateLimit(`owner-signup:${clientIp(req)}`, 10, 3600);
  const code = process.env.OWNER_SETUP_CODE;
  if (code) {
    if (str(b.code, 200) !== code) fail(403, "That setup code isn't right. It's the OWNER_SETUP_CODE set on the server.");
  } else if (process.env.NODE_ENV === 'production') {
    fail(503, "Set OWNER_SETUP_CODE in the host's environment variables and redeploy, so only you can create the owner account.");
  }
  const name = str(b.name, 60).replace(/\s+/g, ' ');
  const email = normEmail(b.email);
  const password = typeof b.password === 'string' ? b.password : '';
  if (name.length < 2) fail(400, 'Add your name.');
  if (!isEmail(email)) fail(400, 'That email looks off.');
  const weak = passwordProblem(password);
  if (weak) fail(400, weak);

  const user = await withLock('owner-signup', async () => {
    if (await ownerExists()) fail(409, 'This café already has an owner. Sign in, or ask the owner to invite you from the Team page.');
    return saveUser(newUser({ kind: 'staff', role: 'owner', name, email, passHash: await hashPassword(password) }));
  });
  await startSession(user);
  await audit({ id: user.id, name: user.name, role: 'owner' }, 'Created the owner account', email);
  return json({ ok: true, next: '/dashboard/overview' });
});
