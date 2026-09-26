import { pkDay } from '@/lib/orderFlow';
import { requireStaff, worksAt } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';
import { ordersOn, placeOrder, staffView, type OrderInput } from '@/lib/server/orders';

/** Order history: `?day=YYYY-MM-DD` (Lahore) and `&days=N` going back from it, up to a month. */
export const GET = route(async (req) => {
  const ctx = await requireStaff(['orders.view']);
  const q = new URL(req.url).searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q.get('day') || '') ? q.get('day')! : pkDay(Date.now());
  const n = Math.min(31, Math.max(1, Number(q.get('days')) || 1));
  const end = Date.parse(`${day}T12:00:00Z`);
  const days = Array.from({ length: n }, (_, i) => new Date(end - i * 86400000).toISOString().slice(0, 10));
  const orders = (await ordersOn(days)).filter((o) => worksAt(ctx.user, o.loc)).sort((a, b) => b.placed - a.placed);
  return json({ days, orders: orders.map((o) => staffView(o, ctx)) });
});

/** An order rung up at the counter or taken at a table. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['orders.create']);
  const b = await readBody<OrderInput>(req);
  const mode = b.mode === 'dinein' || b.mode === 'delivery' ? b.mode : 'pickup';
  const { order } = await placeOrder(
    { ...b, mode, area: b.area ?? null, table: b.table ?? null, address: b.address ?? '', when: 'asap', useReward: false },
    { kind: 'staff', ctx, source: mode === 'dinein' ? 'table' : 'counter' },
  );
  return json({ order: staffView(order, ctx) }, 201);
});
