import { canAny } from '@/lib/rbac';
import { allUsers, requireStaff, worksAt } from '@/lib/server/auth';
import { json, notModified, route, versionEtag } from '@/lib/server/http';
import { activeOrders, expireHolds, liveVersion, openCalls, refundList, riderFixes, staffView, visibleTo } from '@/lib/server/orders';
import { isLive, recentVoiceCalls } from '@/lib/server/voiceLog';
import { countPendingMoments } from '@/lib/server/moments';
import { countPendingReviews } from '@/lib/server/reviews';
import { kv } from '@/lib/server/store';
import { unreadFor } from '@/lib/server/teamMessages';
import { dmThreads } from '@/lib/server/directMessages';
import { liveCalls } from '@/lib/server/rtc';

/**
 * Everything the working screens show, filtered to the caller's role and shops.
 * Polled every few seconds; `?v=` with the last version gets `{ same: true }`
 * back when nothing has changed, which costs one read.
 */
export const GET = route(async (req) => {
  const ctx = await requireStaff();
  await expireHolds();
  const v = await liveVersion();
  const url = new URL(req.url);
  const clientV = url.searchParams.get('v');
  const clientRole = url.searchParams.get('r');
  const etag = versionEtag('staff-live', v, `${ctx.user.id}-${ctx.user.v}`);

  const p = ctx.perms;
  // Where each rider on the road is, from their phone: fixes don't bump the version, so they come with every poll (one small read).
  const fixes = canAny(p, 'delivery.assign', 'orders.manage')
    ? Object.fromEntries(Object.entries(await riderFixes()).filter(([, f]) => worksAt(ctx.user, f.loc)).map(([n, f]) => [n, { t: f.t, lat: f.lat, lng: f.lng, heading: f.heading }]))
    : undefined;

  const unchanged = clientV === String(v) && (!clientRole || clientRole === ctx.role);
  const cached = notModified(req, etag);
  if (cached && unchanged) return cached;
  if (unchanged) {
    return json({ v, same: true, fixes }, 200, { ETag: etag, 'Cache-Control': 'private, no-cache' });
  }

  const [orders, calls, voice, pendingMoments, reservations] = await Promise.all([
    activeOrders(),
    openCalls(),
    canAny(p, 'reports.view') ? recentVoiceCalls() : Promise.resolve([]),
    canAny(p, 'shops.manage', 'reports.view') ? Promise.all([countPendingMoments(), countPendingReviews()]).then(([m, r]) => m + r) : Promise.resolve(0),
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
    fixes,
    // AI voice calls on the line right now, for the Bookings & AI calls badge.
    aiLive: voice.filter((c) => isLive(c)).length,
    pendingMoments,
    upcomingBookings,
    soldOut: ctx.settings.soldOut,
    stock: ctx.settings.stock,
    photos: ctx.settings.photos,
    prepay: ctx.settings.prepay,
    digest: ctx.role === 'owner' ? ctx.settings.digest : undefined,
    signedTables: canAny(p, 'shops.manage') ? ctx.settings.signedTables : undefined,
    // Printed at the top of every bill, so whoever can take payment needs it.
    business: ctx.settings.business,
    // Refunds still owed, for the nav badge.
    refundsDue: canAny(p, 'orders.pay') ? (await refundList(ctx)).pending.length : 0,
    // Team messages they haven't opened yet, for the menu badge.
    unreadMessages: await unreadFor(ctx.user),
    // Private conversations with something new in them, for the badge and the chime.
    // Riders: customers calling them, or calls they're on, by order number.
    rtc: canAny(p, 'delivery.ride') ? (await liveCalls()).filter((c) => orders.some((o) => o.number === c.number && o.rider?.id === ctx.user.id)) : [],
    dms: (await dmThreads(ctx.user)).filter((t) => t.unread > 0).map(({ with: w, name, last, unread }) => ({ with: w, name, last, unread })),
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
    rolePerms: canAny(ctx.perms, 'access.manage') ? ctx.settings.rolePerms : undefined,
  }, 200, { ETag: etag, 'Cache-Control': 'private, no-cache' });
});
