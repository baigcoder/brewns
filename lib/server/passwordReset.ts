/* "I forgot my password" for customers.

   Asking never reveals whether an email has an account: the answer is always the
   same. A link is single-use, lasts an hour, and a newer request cancels an older
   one. Only a hash of the token is kept, so reading the database does not give
   anyone a working link. The link is built from the site's own address, never from
   the request's Host header, so a forged Host cannot make us email a poisoned link. */

import { SITE_URL } from '@/lib/site';
import { findByEmail, hashPassword, passwordProblem, randomToken, saveUser, sha256, startSession, type User } from './auth';
import { sendEmail } from './email';
import { fail } from './http';
import { kv } from './store';

export const RESET_MINUTES = 60;

type Pending = { uid: string; exp: number };

export const resetLink = (token: string, devOrigin?: string) => `${process.env.NODE_ENV === 'production' || !devOrigin ? SITE_URL : devOrigin}/account/reset/${token}`;

/** Sends a reset link if the email belongs to a customer. Says nothing either way. */
export async function requestReset(email: string, devOrigin?: string) {
  const user = await findByEmail('customer', email);
  if (!user || !user.active || !user.passHash) return;
  const token = randomToken(24);
  const hash = sha256(token);
  const old = await kv.get<string>(`pwreset-user:${user.id}`);
  if (old) await kv.del(`pwreset:${old}`);
  await kv.set(`pwreset:${hash}`, { uid: user.id, exp: Date.now() + RESET_MINUTES * 60000 } satisfies Pending, { ttlSec: RESET_MINUTES * 60 });
  await kv.set(`pwreset-user:${user.id}`, hash, { ttlSec: RESET_MINUTES * 60 });
  const link = resetLink(token, devOrigin);
  const sent = await sendEmail({
    to: user.email,
    subject: 'Reset your brewns password',
    text: `Hi ${user.name.split(' ')[0]},\n\nSomeone asked to reset the password for your brewns account. If that was you, open this link and choose a new one. It works once and lasts ${RESET_MINUTES} minutes:\n\n${link}\n\nIf it wasn't you, ignore this email: your password hasn't changed.\n\nbrewns coffee house`,
  });
  // No email service set up yet: say so in the server log (and, while developing, show the link there).
  if (!sent.ok) console.warn('[password reset] No email provider is configured (set RESEND_API_KEY or BREVO_API_KEY), so the link was not sent.');
  if (!sent.ok && process.env.NODE_ENV !== 'production') console.info(`[password reset] dev link for ${user.email}: ${link}`);
}

/** Who a reset link belongs to, if it is still good. */
export async function resetUser(token: string): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const pending = await kv.get<Pending>(`pwreset:${sha256(token)}`);
  if (!pending || pending.exp < Date.now()) return null;
  const { getUser } = await import('./auth');
  const user = await getUser(pending.uid);
  return user && user.kind === 'customer' && user.active ? user : null;
}

/** Sets the new password, ends every other session, uses up the link and signs them in. */
export async function completeReset(token: string, password: string) {
  const user = await resetUser(token);
  if (!user) fail(404, 'This link has expired or was already used. Ask for a new one.');
  const weak = passwordProblem(password);
  if (weak) fail(400, weak);
  const next: User = { ...user!, passHash: await hashPassword(password), v: user!.v + 1 };
  await saveUser(next, user!);
  await kv.del(`pwreset:${sha256(token)}`);
  await kv.del(`pwreset-user:${user!.id}`);
  await startSession(next);
  return next;
}
