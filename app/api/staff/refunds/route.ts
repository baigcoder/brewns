import { requireStaff } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { refundList } from '@/lib/server/orders';

/** Refunds owed and refunds sent, for the shops this person works at. The steps themselves go through the order route. */
export const GET = route(async () => {
  const ctx = await requireStaff(['orders.pay']);
  return json(await refundList(ctx));
});
