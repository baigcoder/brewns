import { requireStaff } from '@/lib/server/auth';
import { dmContacts, dmConversation, dmThreads, sendDm } from '@/lib/server/directMessages';
import { json, readBody, route } from '@/lib/server/http';

/** Their conversations and who they can write to; `?with=<id>` adds that conversation (and reads it). */
export const GET = route(async (req) => {
  const ctx = await requireStaff();
  const other = new URL(req.url).searchParams.get('with');
  const [threads, contacts, messages] = await Promise.all([dmThreads(ctx.user), dmContacts(ctx.user), other ? dmConversation(ctx.user, other) : undefined]);
  return json({ threads, contacts, messages });
});

/** `{ to, text }`: a private message to someone at their shops. Any staff member. */
export const POST = route(async (req) => {
  const ctx = await requireStaff();
  const message = await sendDm(ctx, await readBody(req));
  return json({ message });
});
