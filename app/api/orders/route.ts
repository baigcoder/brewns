import { pkMobile } from '@/lib/catalog';
import { currentCustomer, ownerExists } from '@/lib/server/auth';
import { clientIp, fail, json, rateLimit, readBody, route } from '@/lib/server/http';
import { idempotencyKey, once } from '@/lib/server/idempotency';
import { kv } from '@/lib/server/store';
import { getOrder, placeOrder, publicOrder, type OrderInput } from '@/lib/server/orders';

type Placed = { number: number; key: string; club: unknown; clubState: unknown };

/** An order from the site (pickup, delivery or a table's QR code). The server prices it again. */
export const POST = route(async (req) => {
  await rateLimit(`order:${clientIp(req)}`, 12, 600, 'That is a lot of orders in a few minutes. Call the shop if you need more.');
  if (!(await ownerExists())) fail(503, 'The café has not switched on online orders yet.');
  const copy = req.clone();
  const b = await readBody<OrderInput & { guestReward?: boolean }>(req); // checks the size before anything else
  const text = await copy.text();
  const customer = await currentCustomer();
  // The same order sent twice (a double tap, a retry after a dropped connection) is one order.
  const { value, replayed } = await once<Placed>('order', idempotencyKey(req), `${customer?.id || ''}\n${text}`, async () => {
    // One mobile number cannot flood the kitchen: a prank or a retry loop stops here. A repeat of the same order is not counted.
    const mobile = pkMobile(String(b.phone || '')).replace(/\D/g, '');
    const tally = `rl:order-phone:${mobile}`;
    if (mobile && (await kv.num(tally)) >= 8) fail(429, 'That mobile number has placed a lot of orders in the last hour. Call the shop if you need more.');
    const { order, credit } = await placeOrder(
      { ...b, mode: b.mode === 'delivery' || b.mode === 'dinein' ? b.mode : 'pickup', area: b.area ?? null, table: b.table ?? null, address: b.address ?? '' },
      { kind: 'online', customer, guestReward: !customer && !!b.guestReward },
    );
    if (mobile) await kv.incr(tally, 3600); // only orders that went through count, not typos
    return { number: order.number, key: order.key, club: credit ? { ...credit, state: undefined } : null, clubState: credit?.state ?? null };
  });
  // Always show where the order stands now, not where it stood when it was placed.
  const order = await getOrder(value.number);
  if (!order) fail(404, 'That order could not be found.');
  return json({ order: publicOrder(order!), key: value.key, club: value.club, clubState: value.clubState }, replayed ? 200 : 201);
});
