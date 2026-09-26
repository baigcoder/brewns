import { normaliseClub } from '@/components/brewns/club';
import { pkDay } from '@/lib/orderFlow';
import { allUsers, requireStaff, worksAt } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { ordersOn } from '@/lib/server/orders';

/**
 * Customers: everyone who ordered in the last 30 days (by mobile number, so
 * guests count too), joined with the accounts and club cards people signed up for.
 */
export const GET = route(async () => {
  const ctx = await requireStaff(['customers.view']);
  const now = Date.now();
  const days = Array.from({ length: 30 }, (_, i) => pkDay(now - i * 86400000));
  const orders = (await ordersOn(days)).filter((o) => o.status !== 'cancelled' && worksAt(ctx.user, o.loc));
  const accounts = await allUsers('customer');
  const byPhone = new Map(accounts.map((u) => [u.phone.replace(/\D/g, ''), u]));

  type Row = { key: string; name: string; phone: string; email: string; orders: number; spend: number; last: number; favourite: string; account: boolean; since: number; club: { stamps: number; rewards: number; lifetime: number } | null };
  const rows = new Map<string, Row & { items: Map<string, number> }>();
  for (const o of orders) {
    const key = o.phone.replace(/\D/g, '');
    if (!key) continue;
    const r = rows.get(key) || { key, name: o.name, phone: o.phone, email: o.email, orders: 0, spend: 0, last: 0, favourite: '', account: false, since: 0, club: null, items: new Map() };
    r.orders++;
    r.spend += o.totals.total;
    if (o.placed > r.last) (r.last = o.placed), (r.name = o.name);
    for (const l of o.items) r.items.set(l.name, (r.items.get(l.name) || 0) + l.qty);
    rows.set(key, r);
  }
  for (const u of accounts) {
    const key = u.phone.replace(/\D/g, '');
    const r = rows.get(key) || { key, name: u.name, phone: u.phone, email: u.email, orders: 0, spend: 0, last: 0, favourite: '', account: true, since: u.createdAt, club: null, items: new Map() };
    const c = normaliseClub(u.club);
    Object.assign(r, { account: true, email: u.email, since: u.createdAt, club: c.member ? { stamps: c.stamps, rewards: c.rewards, lifetime: c.lifetime } : null });
    rows.set(key, r);
  }
  const list = [...rows.values()]
    .map(({ items, ...r }) => ({ ...r, favourite: [...items.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '', account: byPhone.has(r.key) || r.account }))
    .sort((a, b) => b.spend - a.spend);
  return json({
    customers: list.slice(0, 300),
    totals: { customers: list.length, accounts: accounts.length, members: accounts.filter((u) => u.club?.member).length, repeat: list.filter((r) => r.orders > 1).length },
  });
});
