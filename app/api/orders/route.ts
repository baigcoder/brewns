import { currentCustomer, ownerExists } from '@/lib/server/auth';
import { clientIp, fail, json, rateLimit, readBody, route } from '@/lib/server/http';
import { placeOrder, publicOrder, type OrderInput } from '@/lib/server/orders';

/** An order from the site (pickup, delivery or a table's QR code). The server prices it again. */
export const POST = route(async (req) => {
  await rateLimit(`order:${clientIp(req)}`, 12, 600, 'That is a lot of orders in a few minutes. Call the shop if you need more.');
  if (!(await ownerExists())) fail(503, 'The café has not switched on online orders yet.');
  const b = await readBody<OrderInput & { guestReward?: boolean }>(req);
  const customer = await currentCustomer();
  const { order, credit } = await placeOrder(
    { ...b, mode: b.mode === 'delivery' || b.mode === 'dinein' ? b.mode : 'pickup', area: b.area ?? null, table: b.table ?? null, address: b.address ?? '' },
    { kind: 'online', customer, guestReward: !customer && !!b.guestReward },
  );
  return json({ order: publicOrder(order), key: order.key, club: credit ? { ...credit, state: undefined } : null, clubState: credit?.state ?? null }, 201);
});
