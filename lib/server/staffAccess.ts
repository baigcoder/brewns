/* Getting staff and owners in, and back in.

   - "I forgot my password" for anyone on the team, the owner included. Without it a
     lone owner who forgets the password is locked out of the café for good. Asking
     never reveals whether an email belongs to the team: the answer is always the same.
   - Invite and password links go to the person's own email, so the person who
     invited them never holds a link that lets them set someone else's password.
     Without an email service set up, the link is handed back to be sent by hand.

   A link is the account's one-time `invite`: the same page and the same single use
   as an invitation, an hour long when it is a reset. The link is built from the
   site's own address, never from the request's Host header. */

import { ROLE_INFO } from '@/lib/rbac';
import { SITE_URL } from '@/lib/site';
import { securityOnce } from './audit';
import { findByEmail, getUser, randomToken, saveUser, sha256, type User } from './auth';
import { renderLinkEmail, sendEmail } from './email';
import { withLock } from './store';

export const RESET_MINUTES = 60;
export const INVITE_DAYS = 7;

/** The address links are built from: the real site in production, the address being browsed while developing. */
export const siteBase = (devOrigin?: string) => (process.env.NODE_ENV === 'production' || !devOrigin ? SITE_URL : devOrigin);

export const staffLink = (token: string, devOrigin?: string) => `${siteBase(devOrigin)}/staff/invite/${token}`;

/** Emails a one-time link to a team member. Returns whether it was sent. */
export async function emailStaffLink(user: Pick<User, 'name' | 'email'> & { role?: User['role'] }, token: string, kind: 'invite' | 'new-link' | 'reset', by: string, devOrigin?: string): Promise<boolean> {
  const link = staffLink(token, devOrigin);
  const first = user.name.split(' ')[0];
  const text =
    kind === 'invite'
      ? `Hi ${first},\n\n${by} has added you to the brewns team. Open this link to choose your password and join. It works once and lasts ${INVITE_DAYS} days:\n\n${link}\n\nIf you weren't expecting this, ignore this email.\n\nbrewns coffee house`
      : kind === 'new-link'
        ? `Hi ${first},\n\n${by} sent you a new link to set your brewns password. It works once and lasts ${INVITE_DAYS} days:\n\n${link}\n\nIf you weren't expecting this, tell ${by}.\n\nbrewns coffee house`
        : `Hi ${first},\n\nSomeone asked to reset the password for your brewns team account. If that was you, open this link and choose a new one. It works once and lasts ${RESET_MINUTES} minutes:\n\n${link}\n\nIf it wasn't you, ignore this email: your password hasn't changed.\n\nbrewns coffee house`;
  const subject = kind === 'invite' ? 'You are invited to the brewns team' : kind === 'new-link' ? 'Your new brewns link' : 'Reset your brewns password';
  const role = user.role && user.role in ROLE_INFO ? ROLE_INFO[user.role as keyof typeof ROLE_INFO].label.toLowerCase() : '';
  const html = renderLinkEmail(
    kind === 'invite'
      ? {
          preview: `${by} added you to the brewns team. Set your password to join.`,
          heading: `Welcome to the team, ${first}`,
          lines: [`${by} has added you to brewns${role ? ` as ${/^[aeiou]/.test(role) ? 'an' : 'a'} ${role}` : ''}.`, 'Tap the button to choose your password. You will land straight in the brewns console, where your orders and deliveries show up.'],
          button: 'Choose my password',
          link,
          note: `This link works once and lasts ${INVITE_DAYS} days. If you weren't expecting it, ignore this email.`,
          signoff: `${by}, brewns coffee house`,
        }
      : kind === 'new-link'
        ? {
            preview: `${by} sent you a new link to set your brewns password.`,
            heading: `A new link for you, ${first}`,
            lines: [`${by} sent you a fresh link to set your brewns password. Any older link has stopped working.`],
            button: 'Set my password',
            link,
            note: `This link works once and lasts ${INVITE_DAYS} days. If you weren't expecting it, tell ${by}.`,
            signoff: `${by}, brewns coffee house`,
          }
        : {
            preview: 'Reset the password for your brewns team account.',
            heading: 'Reset your password',
            lines: [`Hi ${first}, someone asked to reset the password for your brewns team account. If that was you, choose a new one below.`],
            button: 'Choose a new password',
            link,
            note: `This link works once and lasts ${RESET_MINUTES} minutes. If it wasn't you, ignore this email: your password hasn't changed.`,
          },
  );
  return (await sendEmail({ to: user.email, subject, text, html })).ok;
}

/** Sends a reset link if the email belongs to someone on the team who has joined. Says nothing either way. */
export async function requestStaffReset(email: string, devOrigin?: string) {
  const found = await findByEmail('staff', email);
  if (!found || found.role === 'customer' || !found.active || !found.passHash) return;
  const token = randomToken(24);
  const saved = await withLock('team', async () => {
    const fresh = await getUser(found.id);
    if (!fresh || !fresh.active || !fresh.passHash) return null;
    // One link at a time: a new request replaces an older one.
    return saveUser({ ...fresh, invite: { hash: sha256(token), exp: Date.now() + RESET_MINUTES * 60000 } }, fresh);
  });
  if (!saved) return;
  await securityOnce(`staff-reset:${saved.id}`, 3600, { id: saved.id, name: saved.name, role: saved.role }, 'Asked for a password reset link', 'Sent to their email');
  const sent = await emailStaffLink(saved, token, 'reset', saved.name, devOrigin);
  if (!sent) console.warn('[staff reset] No email provider is configured (set SMTP_USER and SMTP_PASS, RESEND_API_KEY or BREVO_API_KEY), so the link was not sent.');
  if (!sent && process.env.NODE_ENV !== 'production') console.info(`[staff reset] dev link for ${saved.email}: ${staffLink(token, devOrigin)}`);
}
