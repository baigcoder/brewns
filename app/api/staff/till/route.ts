import { pkDay } from '@/lib/orderFlow';
import { SHORT_ALERT, tillSummary, varianceLabel, type TillClose } from '@/lib/till';
import { alertOwners } from '@/lib/server/alerts';
import { audit } from '@/lib/server/audit';
import { requireStaff, worksAt } from '@/lib/server/auth';
import { fail, int, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { ordersOn, staffView } from '@/lib/server/orders';
import { kv } from '@/lib/server/store';

const lastClose = (uid: string) => kv.num(`till:last:${uid}`);

/** The signed-in cashier's shift so far (since they last closed the till): what they took and how it was paid. `?float=` is the cash they started with. */
export const GET = route(async (req) => {
  const ctx = await requireStaff(['orders.pay']);
  const day = pkDay(Date.now());
  const float = int(new URL(req.url).searchParams.get('float'), 0, 1_000_000) ?? 0;
  const since = await lastClose(ctx.user.id);
  const orders = (await ordersOn([day])).filter((o) => worksAt(ctx.user, o.loc));
  const till = tillSummary(orders, { id: ctx.user.id, name: ctx.user.name }, float, since);
  // The recent bills in full, so a cashier can print one again without another request.
  const recentOrders = till.recent.map((r) => orders.find((o) => o.number === r.number)!).map((o) => staffView(o, ctx));
  return json({ day, since, till, recentOrders });
});

/**
 * Closes the till: the cashier counts the drawer, the server works out what it should hold from the payments it
 * recorded, and keeps both with the difference. The next shift starts from zero. `{ counted, float, note? }`
 */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['orders.pay']);
  await rateLimit(`till-close:${ctx.user.id}`, 20, 3600);
  const b = await readBody(req);
  const counted = int(b.counted, 0, 10_000_000);
  if (counted === null) return fail(400, 'Enter the cash you counted in the drawer, in whole rupees.');
  const float = int(b.float, 0, 1_000_000) ?? 0;
  const day = pkDay(Date.now());
  const since = await lastClose(ctx.user.id);
  const orders = (await ordersOn([day])).filter((o) => worksAt(ctx.user, o.loc));
  const t = tillSummary(orders, { id: ctx.user.id, name: ctx.user.name }, float, since);
  const close: TillClose = {
    t: Date.now(),
    day,
    uid: ctx.user.id,
    name: ctx.user.name,
    orders: t.orders,
    cash: t.cash,
    card: t.card,
    wallet: t.wallet,
    refundsCash: t.refundsCash,
    float: t.float,
    expected: t.drawer,
    counted,
    variance: counted - t.drawer,
    note: str(b.note, 140),
  };
  await kv.push('till:closes', close, 500);
  await kv.set(`till:last:${ctx.user.id}`, close.t);
  await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, 'Closed the till', `${varianceLabel(close.variance)} · counted Rs ${counted.toLocaleString('en-US')}, expected Rs ${t.drawer.toLocaleString('en-US')}`);
  if (close.variance <= -SHORT_ALERT) {
    await alertOwners(`A till is ${varianceLabel(close.variance).toLowerCase()}`, `${ctx.user.name} closed the till ${varianceLabel(close.variance).toLowerCase()}: counted Rs ${counted.toLocaleString('en-US')}, expected Rs ${t.drawer.toLocaleString('en-US')}.${close.note ? ` Their note: ${close.note}` : ''}`, `till:${close.uid}:${close.t}`);
  }
  return json({ close }, 201);
});
