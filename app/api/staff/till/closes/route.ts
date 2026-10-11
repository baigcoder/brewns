import type { TillClose } from '@/lib/till';
import { requireStaff } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { kv } from '@/lib/server/store';

/** Every time a cashier closed the till, newest first, with what was counted against what was expected. For the owner's overview. */
export const GET = route(async () => {
  await requireStaff(['reports.view']);
  const closes = await kv.list<TillClose>('till:closes', 0, 59);
  return json({ closes });
});
