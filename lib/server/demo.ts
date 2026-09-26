/* Sample data, so a new owner can see the console working before the first
   real order: thirty days of believable orders across the three shops, plus a
   few open right now. Every sample order carries `demo: true`, numbers from
   900001 up (real ones count from 1001) and can be cleared in one go. */

import { CATALOG, DELIVERY, defaultSel, SHOP_COUNT, selLabel, unitPrice } from '@/lib/catalog';
import { FLOW, pkDay, pkMidnight, pkMinutes, stationFor, stationsOf, type Mode, type OrderEvent, type ServerOrder, type Status } from '@/lib/orderFlow';
import { priceOrder } from '@/lib/pricing';
import { randomToken } from './auth';
import { kv } from './store';
import { bumpLive } from './orders';

const FIRST = ['Ayesha', 'Hamza', 'Zara', 'Bilal', 'Mahnoor', 'Usman', 'Fatima', 'Ali', 'Sana', 'Omar', 'Hira', 'Saad', 'Iqra', 'Danish', 'Maryam', 'Fahad', 'Noor', 'Talha', 'Amna', 'Rehan', 'Laiba', 'Hassan', 'Mehwish', 'Zain'];
const LAST = ['Khan', 'Malik', 'Butt', 'Sheikh', 'Chaudhry', 'Qureshi', 'Rana', 'Mirza', 'Awan', 'Siddiqui', 'Javed', 'Raza'];
const STAFF = [
  { id: 'demo-cashier', name: 'Sara (sample)' },
  { id: 'demo-waiter', name: 'Kamran (sample)' },
];
const RIDERS = [
  { id: 'demo-rider-1', name: 'Ahmed Raza', plate: 'LEB 21 4471' },
  { id: 'demo-rider-2', name: 'Bilal Hussain', plate: 'LEC 19 0932' },
  { id: 'demo-rider-3', name: 'Usman Tariq', plate: 'LEA 22 7718' },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Busy at breakfast and after work, with a lunch bump; the shops open 07:00–21:00.
const HOUR_WEIGHT = [0, 0, 0, 0, 0, 0, 0, 5, 10, 9, 6, 5, 7, 8, 6, 5, 6, 8, 9, 8, 6, 0, 0, 0];

export async function seedDemo(now = Date.now()) {
  const r = rng(now % 1e9);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const customers = Array.from({ length: 140 }, (_, i) => ({ name: `${pick(FIRST)} ${pick(LAST)}`, phone: `03${String(10 + (i % 40)).padStart(2, '0')} ${String(1000000 + Math.floor(r() * 8999999))}` }));
  const drinks = CATALOG.filter((p) => p.cat === 'drinks' || p.cat === 'coolers');
  const food = CATALOG.filter((p) => p.cat === 'kitchen' || p.cat === 'bakery');
  const retail = CATALOG.filter((p) => p.cat === 'beans' || p.cat === 'merch');
  const hours = HOUR_WEIGHT.flatMap((w, h) => Array(w).fill(h) as number[]);
  const byDay = new Map<string, ServerOrder[]>();
  const active: ServerOrder[] = [];
  let number = 900000;

  for (let d = 29; d >= 0; d--) {
    const midnight = pkMidnight(now) - d * 86400000;
    const weekend = [0, 6].includes(new Date(midnight + 5 * 3600000).getUTCDay());
    const count = Math.round((weekend ? 55 : 38) * (0.8 + r() * 0.4) * (d === 0 ? Math.min(1, pkMinutes(now) / (21 * 60)) : 1));
    for (let i = 0; i < count; i++) {
      const placed = midnight + pick(hours) * 3600000 + Math.floor(r() * 3600000);
      if (placed > now - 60000) continue;
      const age = now - placed;
      const loc = r() < 0.45 ? 0 : r() < 0.55 ? 1 : 2;
      const m = r();
      const mode: Mode = m < 0.44 ? 'pickup' : m < 0.72 ? 'delivery' : 'dinein';
      const lines = [pick(drinks)];
      if (r() < 0.55) lines.push(pick(food));
      if (r() < 0.25) lines.push(pick(drinks));
      if (r() < 0.06) lines.push(pick(retail));
      const items = lines.map((p) => {
        const sel = defaultSel(p);
        const qty = r() < 0.18 ? 2 : 1;
        const unit = unitPrice(p, sel);
        return { id: p.id, qty, sel, name: p.name, opts: selLabel(p, sel), unit, total: unit * qty, cat: p.cat, station: stationFor(p.cat) };
      });
      const areas = DELIVERY.areas.map((a, k) => [a, k] as const).filter(([a]) => a[1] === loc);
      const area = mode === 'delivery' ? pick(areas)[1] : null;
      const pay = r() < 0.55 ? 0 : r() < 0.6 ? 1 : 2;
      const promoCode = r() < 0.08 ? 'BREWNS10' : '';
      // Deliveries have a minimum: a second drink gets it there.
      if (mode === 'delivery' && items.reduce((s, l) => s + l.total, 0) < DELIVERY.min) {
        items[0].qty += 1;
        items[0].total = items[0].unit * items[0].qty;
      }
      const lead = mode === 'delivery' ? DELIVERY.areas[area!][3] : 12;
      const target = placed + lead * 60000;
      const c = pick(customers);
      const flow = FLOW[mode];
      // How far along it got: all the way for past orders, part way for the last half hour.
      const cancelled = r() < 0.035;
      const readyAfter = (7 + r() * 11) * 60000;
      const endAfter = mode === 'delivery' ? lead * 60000 * (0.85 + r() * 0.35) : readyAfter + (2 + r() * 8) * 60000;
      const times: Partial<Record<Status, number>> = { received: placed, accepted: placed + 40000, preparing: placed + (2 + r() * 2) * 60000, ready: placed + readyAfter };
      if (mode === 'delivery') {
        times.onway = placed + readyAfter + 2 * 60000;
        times.arriving = placed + endAfter - 3 * 60000;
      }
      times[flow.at(-1)!] = placed + endAfter;
      let status: Status = cancelled ? 'cancelled' : flow.at(-1)!;
      if (!cancelled) for (const s of flow) if ((times[s] ?? Infinity) > now) break; else status = s;
      const events: OrderEvent[] = cancelled
        ? [
            { t: placed, what: 'placed', status: 'received' },
            { t: placed + 60000, what: 'cancelled', status: 'cancelled', by: 'Customer' },
          ]
        : flow.filter((s) => (times[s] ?? Infinity) <= now).map((s) => ({ t: times[s]!, what: s, status: s, by: s === 'received' ? 'Customer' : 'Sample' }));
      const rider = mode === 'delivery' && ['ready', 'onway', 'arriving', 'delivered'].includes(status) ? RIDERS[number % RIDERS.length] : null;
      if (rider) events.push({ t: placed + readyAfter - 60000, what: 'rider', by: 'Sample' });
      const source = mode === 'dinein' ? 'table' : r() < 0.25 ? 'counter' : 'online';
      const done = ['collected', 'delivered', 'served'].includes(status);
      const o: ServerOrder = {
        number: ++number,
        day: pkDay(placed),
        placed,
        target,
        mode,
        loc: Math.min(loc, SHOP_COUNT - 1),
        area,
        table: mode === 'dinein' ? 1 + Math.floor(r() * 10) : null,
        address: mode === 'delivery' ? `House ${10 + Math.floor(r() * 300)}, Street ${1 + Math.floor(r() * 30)}` : '',
        name: c.name,
        phone: c.phone,
        email: '',
        note: r() < 0.1 ? pick(['Less ice please', 'Extra hot', 'Call on arrival', 'No onions']) : '',
        pay,
        items,
        totals: priceOrder(items, { mode, area, pay, promoPct: promoCode ? 0.1 : 0, useReward: false }),
        promoCode,
        pickupAt: { t: pkMinutes(target), tomorrow: false },
        status,
        stations: Object.fromEntries(stationsOf(items).map((s) => [s, status === 'received' || status === 'accepted' ? 'queued' : status === 'preparing' ? 'making' : 'done'])),
        events: events.sort((a, b) => a.t - b.t),
        messages: [],
        readByCafe: 0,
        rider,
        paid: done || (mode === 'dinein' && status === 'served' && age > 40 * 60000) ? { t: times[flow.at(-1)!] || placed, by: 'Sample', method: pay } : null,
        source,
        takenBy: source === 'counter' ? STAFF[0] : source === 'table' && r() < 0.5 ? STAFF[1] : null,
        customerId: null,
        key: randomToken(8),
        club: null,
        cancelReason: cancelled ? 'Cancelled by the customer' : undefined,
        demo: true,
      };
      if (o.mode === 'dinein' && o.status === 'served' && age > 45 * 60000) o.paid ||= { t: placed + endAfter, by: 'Sample', method: pay };
      const list = byDay.get(o.day) || [];
      list.push(o);
      byDay.set(o.day, list);
      if (o.status !== 'cancelled' && (!['collected', 'delivered', 'served'].includes(o.status) || (o.mode === 'dinein' && !o.paid))) active.push(o);
    }
  }
  for (const [day, list] of byDay) {
    await kv.hsetMany(`orders:day:${day}`, list.map((o) => [o.number, o]));
    await kv.hsetMany('orders:where', list.map((o) => [o.number, o.day]));
  }
  await kv.hsetMany('orders:active', active.map((o) => [o.number, o]));
  await kv.set('demo:days', [...byDay.keys()]);
  await bumpLive();
  return { orders: [...byDay.values()].reduce((n, l) => n + l.length, 0), open: active.length };
}

export async function clearDemo() {
  const days = (await kv.get<string[]>('demo:days')) || [];
  let n = 0;
  for (const day of days) {
    const demo = Object.values(await kv.hall<ServerOrder>(`orders:day:${day}`)).filter((o) => o.demo).map((o) => o.number);
    await kv.hdel(`orders:day:${day}`, ...demo);
    await kv.hdel('orders:where', ...demo);
    await kv.hdel('orders:active', ...demo);
    n += demo.length;
  }
  await kv.del('demo:days');
  await bumpLive();
  return { removed: n };
}

export const hasDemo = async () => !!(await kv.get<string[]>('demo:days'))?.length;
