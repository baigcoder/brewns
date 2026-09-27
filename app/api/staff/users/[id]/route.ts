import { requireStaff } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';
import { editMember } from '@/lib/server/team';

type Ctx = { params: Promise<{ id: string }> };

/** Changes to one team member; see editMember for who may change what. */
export const POST = route(async (req: Request, c: Ctx) => {
  const ctx = await requireStaff(['staff.manage']);
  const { user, token } = await editMember(ctx, (await c.params).id, await readBody(req));
  return json({ user, link: token ? `${new URL(req.url).origin}/staff/invite/${token}` : '' });
});
