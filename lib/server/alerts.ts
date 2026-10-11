/* Emails the owners when something happens that they would want to know about at
   once: a sign-in locked out, a two-step reset, a password reset, a till that does
   not add up. A few a day, not a flood: each kind is sent at most once an hour for
   the same subject. It never throws, so it can never break what raised it. */

import { SITE_URL } from '@/lib/site';
import { allUsers } from './auth';
import { sendEmail } from './email';
import { kv } from './store';

/** What is worth an email: the start of the activity-log line for a security event. */
export const ALERT_ACTIONS = /^(Sign-in locked|Reset two-step|Turned off two-step|Reset their password)/;

export async function alertOwners(subject: string, text: string, gate: string, ttlSec = 3600): Promise<number> {
  try {
    if (!(await kv.set(`alert:${gate}`, 1, { nx: true, ttlSec }))) return 0;
    const owners = (await allUsers('staff')).filter((u) => u.role === 'owner' && u.active && u.email);
    let sent = 0;
    for (const o of owners) {
      const body = `${text}\n\nSee the activity log: ${SITE_URL}/dashboard/activity\n\nbrewns console`;
      if ((await sendEmail({ to: o.email, subject: `brewns alert · ${subject}`, text: body })).ok) sent++;
    }
    // Nobody could be told (no email service yet): let the next occurrence try again.
    if (!sent) await kv.del(`alert:${gate}`);
    return sent;
  } catch (e) {
    console.warn('[alert owners]', e);
    return 0;
  }
}
