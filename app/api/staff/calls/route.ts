import { requireStaff } from '@/lib/server/auth';
import { json, readBody, route, str } from '@/lib/server/http';
import { answerCall } from '@/lib/server/orders';

/** A waiter on their way: the table's call comes off the board. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['floor.tables', 'orders.manage'], 'any');
  await answerCall(str((await readBody(req)).id, 40), ctx);
  return json({ ok: true });
});
