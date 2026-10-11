import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { completeReset } from '@/lib/server/passwordReset';

/** Finishes a reset: `{ token, password }`. Signs the customer in with the new password. */
export const POST = route(async (req) => {
  await rateLimit(`reset:${clientIp(req)}`, 20, 900);
  const b = await readBody(req);
  await completeReset(str(b.token, 100), typeof b.password === 'string' ? b.password : '');
  return json({ ok: true, next: '/account' });
});
