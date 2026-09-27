import type { Reservation } from '@/app/api/reservations/route';
import { can } from '@/lib/rbac';
import { requireStaff, worksAt } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, json, readBody, route, str } from '@/lib/server/http';
import { bumpLive, liveVersion } from '@/lib/server/orders';
import { kv, withLock } from '@/lib/server/store';
import type { PartyBooking } from '@/lib/server/voiceCall';
import { isLive, recentVoiceCalls } from '@/lib/server/voiceLog';

const SEE: Parameters<typeof requireStaff>[0] = ['reports.view', 'floor.tables', 'orders.view'];
const DAY = 86_400_000;

/**
 * Table bookings, party bookings and the AI voice call log, for the shops the
 * caller works at. Call transcripts hold customers' numbers, so they're for
 * roles with reports (owner and managers by default). Polled every few
 * seconds; `?v=` with the last version gets `{ same: true }` when nothing moved.
 */
export const GET = route(async (req) => {
  const ctx = await requireStaff(SEE, 'any');
  const v = await liveVersion();
  if (new URL(req.url).searchParams.get('v') === String(v)) return json({ v, same: true });

  const now = Date.now();
  const from = new Date(now - DAY).toISOString().slice(0, 10);
  const [res, parties, calls] = await Promise.all([
    kv.hall<Reservation>('reservations'),
    kv.hall<PartyBooking & { loc?: number }>('party_bookings'),
    can(ctx.perms, 'reports.view') ? recentVoiceCalls() : Promise.resolve([]),
  ]);
  const mine = (loc: number | undefined) => worksAt(ctx.user, Number(loc ?? 0));
  const byWhen = (a: { date: string; time: string }, b: { date: string; time: string }) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

  return json({
    v,
    now,
    reservations: Object.values(res || {}).filter((r) => mine(r.loc) && r.date >= from).sort(byWhen),
    parties: Object.values(parties || {}).filter((p) => mine(p.loc) && (!p.date || p.date >= from)).sort((a, b) => byWhen({ date: a.date || '', time: a.time || '' }, { date: b.date || '', time: b.time || '' })),
    calls: calls.map((c) => ({ ...c, live: isLive(c, now) })),
    canSeeCalls: can(ctx.perms, 'reports.view'),
  });
});

/** `{ kind: 'table' | 'party', id, status }`: seat, confirm or cancel a booking. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['floor.tables', 'orders.manage', 'reports.view'], 'any');
  const b = await readBody(req);
  const id = str(b.id, 80);
  const status = str(b.status, 20);
  const kind = b.kind === 'party' ? 'party' : 'table';
  const allowed = kind === 'table' ? ['confirmed', 'seated', 'cancelled'] : ['confirmed', 'done', 'cancelled'];
  if (!allowed.includes(status)) fail(400, 'That status isn’t one of the choices.');
  const hash = kind === 'table' ? 'reservations' : 'party_bookings';

  const item = await withLock(hash, async () => {
    const cur = await kv.hget<{ loc?: number; code: string; status: string }>(hash, id);
    if (!cur) return fail(404, 'That booking is gone.') as never;
    if (!worksAt(ctx.user, Number(cur.loc ?? 0))) fail(403, 'That booking is at a shop you don’t work at.');
    const next = { ...cur, status };
    await kv.hset(hash, id, next);
    return next;
  });
  await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, `Booking ${status}`, item.code);
  await bumpLive();
  return json({ ok: true, item });
});
