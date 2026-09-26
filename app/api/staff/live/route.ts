import { canAny } from '@/lib/rbac';
import { allUsers, requireStaff, worksAt } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { activeOrders, liveVersion, openCalls, staffView, visibleTo } from '@/lib/server/orders';

/**
 * Everything the working screens show, filtered to the caller's role and shops.
 * Polled every few seconds; `?v=` with the last version gets `{ same: true }`
 * back when nothing has changed, which costs one read.
 */
export const GET = route(async (req) => {
  const ctx = await requireStaff();
  const v = await liveVersion();
  if (new URL(req.url).searchParams.get('v') === String(v)) return json({ v, same: true });
  const [orders, calls] = await Promise.all([activeOrders(), openCalls()]);
  const p = ctx.perms;
  const riders = canAny(p, 'delivery.assign')
    ? (await allUsers('staff'))
        .filter((u) => u.role === 'rider' && u.active && (!ctx.user.shops.length || !u.shops.length || u.shops.some((s) => ctx.user.shops.includes(s))))
        .map((u) => ({ id: u.id, name: u.name, plate: u.plate, shops: u.shops, online: Date.now() - u.lastSeenAt < 10 * 60000 }))
    : [];
  return json({
    v,
    now: Date.now(),
    orders: orders.filter((o) => visibleTo(o, ctx)).map((o) => staffView(o, ctx)),
    calls: canAny(p, 'floor.tables', 'orders.manage') ? calls.filter((c) => worksAt(ctx.user, c.loc)) : [],
    riders,
    soldOut: ctx.settings.soldOut,
    shops: ctx.settings.shops,
  });
});
