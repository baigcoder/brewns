/* The numbers on the owner's Overview: sales, orders, what sells, how each
   shop keeps time, and the same figures for the period before, to compare. */

import { PAY, SHOP_COUNT } from '@/lib/catalog';
import { FLOW, pkDay, pkHour, type Mode, type ServerOrder } from '@/lib/orderFlow';
import { worksAt, type StaffContext } from './auth';
import { ordersOn } from './orders';

export type Range = 'today' | 'yesterday' | '7d' | '30d';
export const RANGES: Range[] = ['today', 'yesterday', '7d', '30d'];

const dayList = (endT: number, n: number) => Array.from({ length: n }, (_, i) => pkDay(endT - i * 86400000)).reverse();

function periods(range: Range, now = Date.now()) {
  const D = 86400000;
  switch (range) {
    case 'yesterday':
      return { cur: dayList(now - D, 1), prev: dayList(now - 2 * D, 1) };
    case '7d':
      return { cur: dayList(now, 7), prev: dayList(now - 7 * D, 7) };
    case '30d':
      return { cur: dayList(now, 30), prev: dayList(now - 30 * D, 30) };
    default:
      // Today so far against the same weekday last week, up to the same minute.
      return { cur: dayList(now, 1), prev: dayList(now - 7 * D, 1), cutoff: now - 7 * D };
  }
}

const readyAt = (o: ServerOrder) => o.events.find((e) => e.status === 'ready')?.t;
const doneAt = (o: ServerOrder) => o.events.find((e) => e.status === FLOW[o.mode].at(-1))?.t;

function kpis(orders: ServerOrder[]) {
  const sold = orders.filter((o) => o.status !== 'cancelled');
  const gross = sold.reduce((s, o) => s + o.totals.total, 0);
  const tax = sold.reduce((s, o) => s + o.totals.tax, 0);
  const fees = sold.reduce((s, o) => s + o.totals.fee, 0);
  const discount = sold.reduce((s, o) => s + o.totals.discount, 0);
  const prep = sold.map((o) => (readyAt(o) ? (readyAt(o)! - o.placed) / 60000 : null)).filter((m): m is number => m !== null && m < 180);
  // On time: ready (or delivered) no more than five minutes after the time the customer was given.
  const timed = sold.filter((o) => doneAt(o) || readyAt(o));
  const onTime = timed.filter((o) => ((o.mode === 'delivery' ? doneAt(o) : readyAt(o)) || Infinity) <= o.target + 5 * 60000).length;
  return {
    gross,
    net: gross - tax - fees,
    tax,
    fees,
    discount,
    orders: sold.length,
    avg: sold.length ? gross / sold.length : 0,
    items: sold.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0),
    cancelled: orders.length - sold.length,
    unpaid: sold.filter((o) => !o.paid).reduce((s, o) => s + o.totals.total, 0),
    customers: new Set(sold.map((o) => o.phone.replace(/\D/g, '')).filter(Boolean)).size,
    prepMin: prep.length ? prep.reduce((a, b) => a + b, 0) / prep.length : 0,
    onTimePct: timed.length ? (onTime / timed.length) * 100 : 0,
  };
}

export async function report(range: Range, ctx: StaffContext) {
  const now = Date.now();
  const { cur, prev, cutoff } = periods(range, now);
  const mine = (o: ServerOrder) => worksAt(ctx.user, o.loc);
  const [curOrders, prevOrdersAll] = await Promise.all([ordersOn(cur), ordersOn(prev)]);
  const orders = curOrders.filter(mine);
  const prevOrders = prevOrdersAll.filter(mine).filter((o) => !cutoff || o.placed <= cutoff);
  const sold = orders.filter((o) => o.status !== 'cancelled');

  const byHour = Array.from({ length: 24 }, (_, h) => ({ h, sales: 0, orders: 0 }));
  for (const o of sold) {
    const b = byHour[pkHour(o.placed)];
    b.sales += o.totals.total;
    b.orders++;
  }
  const byDay = cur.map((day) => {
    const list = sold.filter((o) => o.day === day);
    return { day, sales: list.reduce((s, o) => s + o.totals.total, 0), orders: list.length };
  });
  const byShop = Array.from({ length: SHOP_COUNT }, (_, loc) => ({ loc, ...kpis(orders.filter((o) => o.loc === loc)) })).filter((s) => worksAt(ctx.user, s.loc));
  const byMode = (['pickup', 'delivery', 'dinein'] as Mode[]).map((mode) => {
    const list = sold.filter((o) => o.mode === mode);
    return { mode, orders: list.length, sales: list.reduce((s, o) => s + o.totals.total, 0) };
  });
  const byPay = PAY.map((p, i) => {
    const list = sold.filter((o) => (o.paid?.method ?? o.pay) === i);
    return { pay: i, label: p[0], orders: list.length, sales: list.reduce((s, o) => s + o.totals.total, 0) };
  });
  const items = new Map<string, { id: string; name: string; cat: string; qty: number; sales: number }>();
  for (const o of sold)
    for (const l of o.items) {
      const it = items.get(l.id) || { id: l.id, name: l.name, cat: l.cat, qty: 0, sales: 0 };
      it.qty += l.qty;
      it.sales += l.total;
      items.set(l.id, it);
    }
  const top = [...items.values()].sort((a, b) => b.sales - a.sales).slice(0, 10);
  const promos = new Map<string, { code: string; uses: number; discount: number }>();
  for (const o of sold)
    if (o.promoCode) {
      const p = promos.get(o.promoCode) || { code: o.promoCode, uses: 0, discount: 0 };
      p.uses++;
      p.discount += o.totals.promo;
      promos.set(o.promoCode, p);
    }
  // The team's share: orders rung up, deliveries ridden.
  const team = new Map<string, { name: string; taken: number; rides: number; sales: number }>();
  for (const o of sold) {
    if (o.takenBy) {
      const t = team.get(o.takenBy.id) || { name: o.takenBy.name, taken: 0, rides: 0, sales: 0 };
      t.taken++;
      t.sales += o.totals.total;
      team.set(o.takenBy.id, t);
    }
    if (o.rider && o.status === 'delivered') {
      const t = team.get(o.rider.id) || { name: o.rider.name, taken: 0, rides: 0, sales: 0 };
      t.rides++;
      team.set(o.rider.id, t);
    }
  }
  const source = (['online', 'counter', 'table'] as const).map((s) => ({ source: s, orders: sold.filter((o) => o.source === s).length }));
  const phones = new Map<string, number>();
  for (const o of sold) {
    const p = o.phone.replace(/\D/g, '');
    if (p) phones.set(p, (phones.get(p) || 0) + 1);
  }

  return {
    range,
    days: cur,
    now,
    kpis: kpis(orders),
    prev: kpis(prevOrders),
    byHour,
    byDay,
    byShop,
    byMode,
    byPay,
    top,
    promos: [...promos.values()].sort((a, b) => b.uses - a.uses),
    team: [...team.values()].sort((a, b) => b.taken + b.rides - (a.taken + a.rides)).slice(0, 8),
    source,
    repeatCustomers: [...phones.values()].filter((n) => n > 1).length,
    recent: sold
      .sort((a, b) => b.placed - a.placed)
      .slice(0, 8)
      .map((o) => ({ number: o.number, placed: o.placed, name: o.name, total: o.totals.total, mode: o.mode, status: o.status, loc: o.loc, table: o.table })),
    demo: orders.some((o) => o.demo),
  };
}
