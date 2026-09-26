import { pkMobile } from '@/lib/catalog';
import { findByEmail, findCustomerByPhone, hashPassword, newUser, passwordProblem, saveUser, startSession } from '@/lib/server/auth';
import { importClub } from '@/lib/server/customers';
import { clientIp, fail, isEmail, json, normEmail, rateLimit, readBody, route, str } from '@/lib/server/http';
import { withLock } from '@/lib/server/store';

/** A customer account: order history on any device, and a club card that follows you. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  await rateLimit(`customer-signup:${clientIp(req)}`, 10, 3600);
  const name = str(b.name, 40).replace(/\s+/g, ' ');
  const email = normEmail(b.email);
  const phone = pkMobile(str(b.phone, 20));
  const password = typeof b.password === 'string' ? b.password : '';
  if (name.length < 2) fail(400, 'Add your name.');
  if (!isEmail(email)) fail(400, 'That email looks off.');
  if (!phone) fail(400, 'A Pakistani mobile, like 0300 1234567.');
  const weak = passwordProblem(password);
  if (weak) fail(400, weak);

  const user = await withLock('customer-signup', async () => {
    if (await findByEmail('customer', email)) fail(409, 'There is already an account with that email. Sign in instead.');
    if (await findCustomerByPhone(phone)) fail(409, 'That mobile number already has an account. Sign in instead.');
    return saveUser(newUser({ kind: 'customer', role: 'customer', name, email, phone, passHash: await hashPassword(password) }));
  });
  // A club card already on this device comes along.
  const imported = b.club ? (await importClub(user, b.club)).imported : false;
  await startSession(user);
  return json({ ok: true, imported, next: '/account' });
});
