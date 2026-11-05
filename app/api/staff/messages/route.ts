import { can } from '@/lib/rbac';
import { requireStaff } from '@/lib/server/auth';
import { fail, json, readBody, route } from '@/lib/server/http';
import { markRead, messagesFor, postMessage } from '@/lib/server/teamMessages';

/** The team's messages, as this person sees them. */
export const GET = route(async () => {
  const ctx = await requireStaff();
  return json(await messagesFor(ctx.user));
});

/** `{ read: true }` marks them read (anyone); `{ text, email? }` sends one (owners and managers: staff.manage). */
export const POST = route(async (req) => {
  const ctx = await requireStaff();
  const b = await readBody(req);
  if (b.read === true) {
    await markRead(ctx.user);
    return json({ ok: true });
  }
  if (!can(ctx.perms, 'staff.manage')) fail(403, 'Only owners and managers can message the whole team.');
  const message = await postMessage(ctx, b);
  return json({ message, ...(await messagesFor(ctx.user)) });
});
