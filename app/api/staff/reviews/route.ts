import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, json, readBody, route, str } from '@/lib/server/http';
import { approveReview, deleteReview, reviewsForConsole } from '@/lib/server/reviews';

/** Reviews waiting for a look, and the latest live ones (so a bad one can be taken down). */
export const GET = route(async () => {
  await requireStaff(['shops.manage', 'reports.view'], 'any');
  const { pending, live } = await reviewsForConsole();
  return json({ pending, live: live.slice(0, 30) });
});

/** `{ action: 'approve' | 'delete', id }`. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['shops.manage']);
  const b = await readBody(req);
  const id = str(b.id, 40);
  if (!id) fail(400, 'Which review?');
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  if (b.action === 'approve') {
    if (!(await approveReview(id))) fail(404, 'That review is gone.');
    await audit(actor, 'Approved a review', id);
  } else if (b.action === 'delete') {
    if (!(await deleteReview(id))) fail(404, 'That review is gone.');
    await audit(actor, 'Deleted a review', id);
  } else fail(400, 'Approve or delete?');
  const { pending, live } = await reviewsForConsole();
  return json({ pending, live: live.slice(0, 30) });
});
