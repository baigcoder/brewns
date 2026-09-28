import { canAny } from '@/lib/rbac';
import { allUsers, requireStaff, worksAt } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { activeOrders, liveVersion, openCalls, staffView, visibleTo } from '@/lib/server/orders';
import { isLive, recentVoiceCalls } from '@/lib/server/voiceLog';
import { countPendingMoments } from '@/lib/server/moments';
import { kv } from '@/lib/server/store';

/**
 * Everything the working screens show, filtered to the caller's role and shops.
 * Polled every few seconds; `?v=` with the last version gets `{ same: true }`
 * back when nothing has changed, which costs one read.
 */
export const GET = route(async (req) => {
  const ctx = await requireStaff();
  const v = await liveVersion();
  const url = new URL(req.url);
  const clientV = url.searchParams.get('v');
  const clientRole = url.searchParams.get('r');

  // If live version matches and role hasn't changed, return 304-equivalent same payload
  if (clientV === String(v) && (!clientRole || clientRole === ctx.role)) {
    return json({ v, same: true });
  }

  const p = ctx.perms;
  const [orders, calls, voice, pendingMoments, reservations] = await Promise.all([
    activeOrders(),
    openCalls(),
    canAny(p, 'reports.view') ? recentVoiceCalls() : Promise.resolve([]),
    canAny(p, 'shops.manage', 'reports.view') ? countPendingMoments() : Promise.resolve(0),
    canAny(p, 'reports.view', 'floor.tables')
      ? kv.hall<{ loc?: number; status?: string; date?: string }>('reservations')
      : Promise.resolve({} as Record<string, { loc?: number; status?: string; date?: string }>),
  ]);
  const riders = canAny(p, 'delivery.assign')
    ? (await allUsers('staff'))
        .filter((u) => u.role === 'rider' && u.active && (!ctx.user.shops.length || !u.shops.length || u.shops.some((s) => ctx.user.shops.includes(s))))
        .map((u) => ({ id: u.id, name: u.name, plate: u.plate, shops: u.shops, online: Date.now() - u.lastSeenAt < 10 * 60000 }))
    : [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingBookings = Object.values(reservations || {})
    .filter((r) => worksAt(ctx.user, Number(r.loc ?? 0)) && r.status !== 'seated' && r.status !== 'cancelled' && String(r.date || '') >= todayStr)
    .length;

  return json({
    v,
    now: Date.now(),
    orders: orders.filter((o) => visibleTo(o, ctx)).map((o) => staffView(o, ctx)),
    calls: canAny(p, 'floor.tables', 'orders.manage') ? calls.filter((c) => worksAt(ctx.user, c.loc)) : [],
    riders,
    // AI voice calls on the line right now, for the Bookings & AI calls badge.
    aiLive: voice.filter((c) => isLive(c)).length,
    pendingMoments,
    upcomingBookings,
    soldOut: ctx.settings.soldOut,
    shops: ctx.settings.shops,
    // Dynamic realtime RBAC details
    me: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.role,
      shops: ctx.user.shops,
      active: ctx.user.active,
    },
    perms: ctx.perms,
    rolePerms: ctx.settings.rolePerms,
  });
});
