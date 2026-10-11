import { requireStaff } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';
import { emailStaffLink, staffLink } from '@/lib/server/staffAccess';
import { invite, listTeam } from '@/lib/server/team';

export const GET = route(async () => {
  await requireStaff(['staff.view']);
  return json({ team: await listTeam() });
});

/**
 * Invites someone. The one-time link goes to their own email; only when no email service is set up is it handed back
 * (as `link`) to be sent by hand, so the person inviting never holds a link that sets someone else's password.
 */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['staff.manage']);
  const { user, token } = await invite(ctx, await readBody(req));
  const origin = new URL(req.url).origin;
  const emailed = await emailStaffLink(user, token, 'invite', ctx.user.name, origin);
  return json({ user, emailed, link: emailed ? '' : staffLink(token, origin) }, 201);
});
