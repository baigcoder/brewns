import { requireStaff } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';
import { invite, listTeam } from '@/lib/server/team';

const inviteLink = (req: Request, token: string) => (token ? `${new URL(req.url).origin}/staff/invite/${token}` : '');

export const GET = route(async () => {
  await requireStaff(['staff.view']);
  return json({ team: await listTeam() });
});

/** Invites someone: returns the one-time link to send them (by WhatsApp, say). */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['staff.manage']);
  const { user, token } = await invite(ctx, await readBody(req));
  return json({ user, link: inviteLink(req, token) }, 201);
});
