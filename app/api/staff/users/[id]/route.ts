import { requireStaff } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';
import { emailStaffLink, staffLink } from '@/lib/server/staffAccess';
import { editMember } from '@/lib/server/team';

type Ctx = { params: Promise<{ id: string }> };

/** Changes to one team member; see editMember for who may change what. A new link goes to their email when it can. */
export const POST = route(async (req: Request, c: Ctx) => {
  const ctx = await requireStaff(['staff.manage']);
  const { user, token } = await editMember(ctx, (await c.params).id, await readBody(req));
  if (!token || !user) return json({ user, emailed: false, link: '' });
  const origin = new URL(req.url).origin;
  const emailed = await emailStaffLink(user, token, 'new-link', ctx.user.name, origin);
  return json({ user, emailed, link: emailed ? '' : staffLink(token, origin) });
});
