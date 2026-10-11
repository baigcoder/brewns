import { endSession, requireCustomer, verifyPassword } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { deleteCustomer } from '@/lib/server/customers';
import { clientIp, fail, json, rateLimit, readBody, route } from '@/lib/server/http';

/** Deletes the signed-in customer's account, after they confirm with their password. Their past orders stay, with their details taken off. */
export const POST = route(async (req) => {
  const user = await requireCustomer();
  await rateLimit(`delete-account:${user.id}:${clientIp(req)}`, 5, 3600);
  const b = await readBody(req);
  if (!(await verifyPassword(String(b.password || ''), user.passHash))) fail(403, "That password isn't right.");
  const { orders } = await deleteCustomer(user);
  await audit(null, 'A customer deleted their account', `${user.id} · ${orders} past order${orders === 1 ? '' : 's'} kept without their details`, 'security');
  await endSession('customer');
  return json({ ok: true, next: '/' });
});
