import { clientIp, isEmail, json, normEmail, rateLimit, readBody, route } from '@/lib/server/http';
import { requestStaffReset } from '@/lib/server/staffAccess';

/**
 * Starts a password reset for someone on the team, the owner included. The reply is the same whether or not the
 * email belongs to the team, so this cannot be used to find out who works here.
 */
export const POST = route(async (req) => {
  await rateLimit(`staff-forgot:${clientIp(req)}`, 8, 3600, 'Too many reset requests. Try again in an hour.');
  const email = normEmail((await readBody(req)).email);
  if (isEmail(email)) {
    await rateLimit(`staff-forgot-email:${email}`, 3, 3600, 'Too many reset requests for that email. Try again in an hour.');
    await requestStaffReset(email, new URL(req.url).origin);
  }
  return json({ ok: true, next: '/staff/signin?sent=1' });
});
