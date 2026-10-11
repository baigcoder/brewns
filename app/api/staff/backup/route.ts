import { pkDay } from '@/lib/orderFlow';
import { allUsers, publicUser, requireStaff } from '@/lib/server/auth';
import { audit, readAudit } from '@/lib/server/audit';
import { rateLimit, route } from '@/lib/server/http';
import { ordersOn } from '@/lib/server/orders';
import { getSettings } from '@/lib/server/settings';
import { kv } from '@/lib/server/store';

const DAYS = 90;

/**
 * A copy of the café's records as one file, for the owner to keep: settings, the team, the last 90 days of orders,
 * refunds, reviews, tills and the activity log. Passwords, two-step secrets, sign-in links and customers' tracking
 * keys are never in it. Owners only, and each download is written to the activity log.
 */
export const GET = route(async () => {
  const ctx = await requireStaff(['access.manage']);
  await rateLimit(`backup:${ctx.user.id}`, 6, 3600, 'That is a lot of backups in an hour. Try again later.');
  const days = Array.from({ length: DAYS }, (_, i) => pkDay(Date.now() - i * 86400000));
  const [settings, team, orders, refunds, reviews, closes, log] = await Promise.all([
    getSettings(),
    allUsers('staff'),
    ordersOn(days),
    kv.hall('refunds'),
    kv.hall('reviews'),
    kv.list('till:closes', 0, 499),
    readAudit(1000),
  ]);
  const file = {
    about: 'A backup of the brewns café records. Keep it somewhere private: it holds customers’ names and phone numbers. Passwords, two-step secrets and sign-in links are not in it.',
    exportedAt: new Date().toISOString(),
    exportedBy: ctx.user.name,
    days: DAYS,
    settings,
    team: team.map((u) => publicUser(u)),
    orders: orders.map(({ key: _key, ...o }) => o),
    refunds: Object.values(refunds),
    reviews: Object.values(reviews),
    tillCloses: closes,
    activity: log,
  };
  await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, 'Downloaded a backup', `${orders.length} orders, ${team.length} team members`, 'security');
  return new Response(JSON.stringify(file), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="brewns-backup-${pkDay(Date.now())}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
