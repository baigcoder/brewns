import { pkMobile } from '@/lib/catalog';
import { currentCustomer, findCustomerByPhone, hashPassword, passwordProblem, requireCustomer, saveUser, startSession, verifyPassword } from '@/lib/server/auth';
import { clubOf, customerView } from '@/lib/server/customers';
import { fail, json, readBody, route, str } from '@/lib/server/http';

/** Who is signed in on the site, with their club card. Not signed in is an answer, not an error. */
export const GET = route(async () => {
  const u = await currentCustomer();
  if (!u) return json({ user: null });
  return json({ user: customerView(u), club: await clubOf(u) });
});

export const PATCH = route(async (req) => {
  const u = await requireCustomer();
  const b = await readBody(req);
  const next = { ...u };
  if (b.name !== undefined) {
    const name = str(b.name, 40).replace(/\s+/g, ' ');
    if (name.length < 2) fail(400, 'Add your name.');
    next.name = name;
  }
  if (b.phone !== undefined) {
    const phone = pkMobile(str(b.phone, 20));
    if (!phone) fail(400, 'A Pakistani mobile, like 0300 1234567.');
    const other = await findCustomerByPhone(phone);
    if (other && other.id !== u.id) fail(409, 'That mobile number is on another account.');
    next.phone = phone;
    if (next.club?.member) next.club = { ...next.club, member: { ...next.club.member, phone } };
  }
  if (b.newPassword !== undefined) {
    if (!(await verifyPassword(String(b.password || ''), u.passHash))) fail(403, "Your current password isn't right.");
    const weak = passwordProblem(String(b.newPassword));
    if (weak) fail(400, weak);
    next.passHash = await hashPassword(String(b.newPassword));
    next.v += 1;
  }
  await saveUser(next, u);
  if (b.newPassword !== undefined) await startSession(next);
  return json({ user: customerView(next) });
});
