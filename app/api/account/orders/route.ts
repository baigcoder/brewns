import { requireCustomer } from '@/lib/server/auth';
import { customerOrderRefs } from '@/lib/server/customers';
import { json, route } from '@/lib/server/http';
import { getOrder, publicOrder } from '@/lib/server/orders';

/** The signed-in customer's recent orders, with how each one stands. */
export const GET = route(async () => {
  const u = await requireCustomer();
  const refs = await customerOrderRefs(u.id, 30);
  const orders = (await Promise.all(refs.map((r) => getOrder(r.number)))).filter((o) => o && o.customerId === u.id);
  return json({ orders: orders.map((o) => ({ ...publicOrder(o!), key: o!.key })) });
});
