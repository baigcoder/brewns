import { clientIp, isEmail, json, normEmail, rateLimit, readBody, route } from '@/lib/server/http';
import { requestReset } from '@/lib/server/passwordReset';

/**
 * Starts a password reset for a customer. The reply is the same whether or not the email has an account,
 * so this cannot be used to find out who is registered.
 */
export const POST = route(async (req) => {
  await rateLimit(`forgot:${clientIp(req)}`, 8, 3600, 'Too many reset requests. Try again in an hour.');
  const email = normEmail((await readBody(req)).email);
  if (isEmail(email)) {
    await rateLimit(`forgot-email:${email}`, 3, 3600, 'Too many reset requests for that email. Try again in an hour.');
    await requestReset(email, new URL(req.url).origin);
  }
  return json({ ok: true, next: '/account/signin?sent=1' });
});
