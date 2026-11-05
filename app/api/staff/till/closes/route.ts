import { closesVisibleTo, type TillClose } from '@/lib/till';
import { requireStaff } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { kv } from '@/lib/server/store';

/** Every time a cashier closed the till, newest first, with what was counted against what was expected. For the owner's overview. */
export const GET = route(async () => {
  const ctx = await requireStaff(['reports.view']);
  const closes = await kv.list<TillClose>('till:closes', 0, 499);
  return json({ closes: closesVisibleTo(closes, ctx.user).slice(0, 60) });
});
