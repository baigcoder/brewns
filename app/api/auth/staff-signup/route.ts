import { homeFor, permsFor, ROLES, type Role } from '@/lib/rbac';
import { allUsers, findByEmail, hashPassword, newUser, ownerExists, passwordProblem, saveUser, startSession } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clientIp, fail, isEmail, json, normEmail, rateLimit, readBody, route, str } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';
import { withLock } from '@/lib/server/store';
import { SHOP_COUNT } from '@/lib/catalog';

const ALLOWED_STAFF_ROLES: readonly Role[] = ['manager', 'cashier', 'barista', 'chef', 'waiter', 'rider'];

/** Public sign-up flow for new staff roles. Allows joining the team directly. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  const ip = clientIp(req);
  await rateLimit(`staff-signup:${ip}`, ip === 'local' ? 300 : 20, 3600);

  const name = str(b.name, 60).replace(/\s+/g, ' ');
  const email = normEmail(b.email);
  const password = typeof b.password === 'string' ? b.password : '';
  const rawRole = str(b.role, 30).toLowerCase() as Role;
  const phone = str(b.phone, 20);
  const plate = str(b.plate, 20).toUpperCase();

  if (name.length < 2) fail(400, 'Add your full name.');
  if (!isEmail(email)) fail(400, 'Enter a valid email address.');

  const weak = passwordProblem(password);
  if (weak) fail(400, weak);

  // Allow owner signup only if no owner exists yet
  let role: Role;
  if (rawRole === 'owner') {
    if (await ownerExists()) {
      fail(403, 'The owner account is already claimed. Sign in as owner or choose another role.');
    }
    role = 'owner';
  } else if (!ALLOWED_STAFF_ROLES.includes(rawRole)) {
    fail(400, `Pick a valid role: ${ALLOWED_STAFF_ROLES.join(', ')}.`);
    role = 'barista'; // fallback for type safety
  } else {
    role = rawRole;
  }

  // Parse shops selection
  let shops: number[] = [];
  if (Array.isArray(b.shops)) {
    shops = [...new Set(b.shops.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < SHOP_COUNT))].sort();
  } else if (typeof b.shops === 'number' && b.shops >= 0 && b.shops < SHOP_COUNT) {
    shops = [b.shops];
  } else if (typeof b.shop === 'string' && b.shop !== 'all' && b.shop !== '') {
    const s = Number(b.shop);
    if (Number.isInteger(s) && s >= 0 && s < SHOP_COUNT) shops = [s];
  }

  const user = await withLock('team', async () => {
    if (await findByEmail('staff', email)) {
      fail(409, 'Someone on the team is already using that email. Sign in instead.');
    }

    const passHash = await hashPassword(password);
    const created = newUser({
      kind: 'staff',
      role,
      name,
      email,
      phone,
      plate: role === 'rider' ? plate : '',
      shops,
      passHash,
      invitedBy: 'Self sign-up',
    });

    return saveUser(created);
  });

  await startSession(user);
  await audit({ id: user.id, name: user.name, role: user.role }, `Joined the team as ${role}`, email);

  const settings = await getSettings();
  const next = homeFor(role, permsFor(role, settings.rolePerms));

  return json({ ok: true, role, next }, 201);
});
