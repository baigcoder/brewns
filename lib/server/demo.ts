/* Sample & realistic café simulation data.
   Allows owners and managers to populate a realistic day of orders, kitchen tickets,
   seated tables, delivery dispatches, and financial analytics to test the system,
   and clean it up completely with one click. Real orders and accounts are never touched. */

import { LOC_TITLES } from '@/lib/catalog';
import { pkDay, pkMidnight, type Mode, type OrderEvent, type OrderLine, type ServerOrder, type Station, type Status } from '@/lib/orderFlow';
import { bumpLive } from './orders';
import { kv, withLock } from './store';

export async function clearDemo() {
  const days = (await kv.get<string[]>('demo:days')) || [];
  let n = 0;
  for (const day of days) {
    const all = await kv.hall<ServerOrder>(`orders:day:${day}`);
    const demo = Object.values(all).filter((o) => o.demo).map((o) => o.number);
    if (!demo.length) continue;
    await kv.hdel(`orders:day:${day}`, ...demo);
    await kv.hdel('orders:where', ...demo);
    await kv.hdel('orders:active', ...demo);
    n += demo.length;
  }
  // Clear open demo calls on tables
  const calls = (await kv.get<Array<{ id: string; loc: number; table: number; kind: string; t: number; demo?: boolean }>>('calls:open')) || [];
  const cleanCalls = calls.filter((c) => !c.demo);
  await kv.set('calls:open', cleanCalls);

  await kv.del('demo:days');
  await bumpLive();
  return { removed: n };
}

export const hasDemo = async () => !!(await kv.get<string[]>('demo:days'))?.length;

/** Seed a full, realistic day of café operations for Lahore (today and 7 days history for analytics comparisons) */
export async function seedRealisticDay(): Promise<{ created: number; days: string[] }> {
  return withLock('demo_seed', async () => {
    // Clear any previous demo orders first
    await clearDemo();

    const now = Date.now();
    const today = pkDay(now);
    const midnight = pkMidnight(now);

    const D = 86400000;
    const daysToSeed = [
      today,
      pkDay(now - D),       // Yesterday
      pkDay(now - 7 * D),   // Same day last week (for delta comparison)
    ];

    let orderNum = 1100;
    let totalCreated = 0;

    const sampleCustomers = [
      { name: 'Maya Rehman', phone: '0300 4821945' },
      { name: 'Hamza Kiani', phone: '0321 9928172' },
      { name: 'Ayesha Khan', phone: '0333 5182903' },
      { name: 'Farhan Ali', phone: '0302 8472910' },
      { name: 'Zainab Tariq', phone: '0312 4019283' },
      { name: 'Omer Sheikh', phone: '0301 6291028' },
      { name: 'Bilal Hassan', phone: '0322 7109284' },
      { name: 'Sana Malik', phone: '0300 1928374' },
      { name: 'Usman Dar', phone: '0334 8291039' },
      { name: 'Fatima Zahra', phone: '0321 4820192' },
    ];

    const dishes: Array<{ id: string; name: string; cat: string; station: Station; price: number; opts?: string }> = [
      { id: 'smash-burger', name: 'Classic Smash Burger', cat: 'kitchen', station: 'kitchen', price: 1350 },
      { id: 'zinger-burger', name: 'Crispy Zinger Burger', cat: 'kitchen', station: 'kitchen', price: 1150 },
      { id: 'bbq-burger', name: 'Smoky BBQ Beef Burger', cat: 'kitchen', station: 'kitchen', price: 1550 },
      { id: 'alfredo-pasta', name: 'Chicken Alfredo Fettuccine', cat: 'kitchen', station: 'kitchen', price: 1450 },
      { id: 'pepperoni-pizza', name: 'Pepperoni Pizza · 10"', cat: 'kitchen', station: 'kitchen', price: 1750 },
      { id: 'chicken-paratha-roll', name: 'Chicken Paratha Roll', cat: 'kitchen', station: 'kitchen', price: 650 },
      { id: 'iced-matcha', name: 'Iced Matcha Latte', cat: 'drinks', station: 'bar', price: 1150 },
      { id: 'nitro-cold-brew', name: 'Nitro Cold Brew', cat: 'drinks', station: 'bar', price: 1100 },
      { id: 'latte', name: 'Iced Spanish Latte', cat: 'drinks', station: 'bar', price: 850 },
      { id: 'flat-white', name: 'Flat White', cat: 'drinks', station: 'bar', price: 800 },
      { id: 'slow-roast', name: 'Slow Roast Whole Beans (250g)', cat: 'beans', station: 'counter', price: 3800 },
    ];

    // Schedules of orders throughout today (hours 8 to 21)
    const schedule: Array<{
      hour: number;
      min: number;
      loc: number;
      mode: Mode;
      table?: number;
      itemsIdx: number[];
      payMethod: number; // 0 cash, 1 card, 2 wallet
      status: Status;
      isLiveActive?: boolean;
    }> = [
      // Morning rush 08:00 - 10:30 (Espresso & Bakery)
      { hour: 8, min: 12, loc: 0, mode: 'pickup', itemsIdx: [8, 9], payMethod: 1, status: 'collected' },
      { hour: 8, min: 35, loc: 0, mode: 'dinein', table: 2, itemsIdx: [9, 8], payMethod: 0, status: 'served' },
      { hour: 9, min: 5, loc: 1, mode: 'pickup', itemsIdx: [6, 10], payMethod: 1, status: 'collected' },
      { hour: 9, min: 20, loc: 0, mode: 'delivery', itemsIdx: [8, 7], payMethod: 2, status: 'delivered' },
      { hour: 9, min: 45, loc: 2, mode: 'dinein', table: 5, itemsIdx: [9, 9], payMethod: 0, status: 'served' },
      { hour: 10, min: 10, loc: 1, mode: 'pickup', itemsIdx: [7, 6], payMethod: 1, status: 'collected' },

      // Lunch Rush 12:30 - 15:00 (Burgers, Pasta, Pizza)
      { hour: 12, min: 30, loc: 0, mode: 'dinein', table: 4, itemsIdx: [0, 8], payMethod: 1, status: 'served' },
      { hour: 12, min: 50, loc: 0, mode: 'delivery', itemsIdx: [0, 1, 8], payMethod: 0, status: 'delivered' },
      { hour: 13, min: 15, loc: 1, mode: 'dinein', table: 1, itemsIdx: [3, 4, 7], payMethod: 1, status: 'served' },
      { hour: 13, min: 40, loc: 2, mode: 'delivery', itemsIdx: [2, 0], payMethod: 2, status: 'delivered' },
      { hour: 14, min: 5, loc: 0, mode: 'dinein', table: 6, itemsIdx: [0, 5, 8], payMethod: 1, status: 'served' },
      { hour: 14, min: 30, loc: 1, mode: 'pickup', itemsIdx: [1, 7], payMethod: 0, status: 'collected' },

      // Afternoon pick-me-up 15:30 - 17:30
      { hour: 15, min: 45, loc: 0, mode: 'pickup', itemsIdx: [6, 10], payMethod: 1, status: 'collected' },
      { hour: 16, min: 15, loc: 2, mode: 'dinein', table: 3, itemsIdx: [8, 9], payMethod: 2, status: 'served' },
      { hour: 16, min: 50, loc: 1, mode: 'delivery', itemsIdx: [7, 8], payMethod: 1, status: 'delivered' },
      { hour: 17, min: 20, loc: 0, mode: 'pickup', itemsIdx: [6, 7], payMethod: 0, status: 'collected' },

      // Evening peak 18:00 - 21:00
      { hour: 18, min: 10, loc: 0, mode: 'dinein', table: 8, itemsIdx: [4, 0, 8], payMethod: 1, status: 'served' },
      { hour: 18, min: 40, loc: 1, mode: 'delivery', itemsIdx: [0, 2, 7], payMethod: 2, status: 'delivered' },
      { hour: 19, min: 15, loc: 2, mode: 'dinein', table: 2, itemsIdx: [3, 8], payMethod: 0, status: 'served' },
      { hour: 19, min: 45, loc: 0, mode: 'delivery', itemsIdx: [4, 1], payMethod: 1, status: 'delivered' },

      // CURRENT ACTIVE LIVE TICKETS (right now on the line!)
      { hour: 20, min: 15, loc: 0, mode: 'pickup', itemsIdx: [6, 7], payMethod: 1, status: 'ready', isLiveActive: true },
      { hour: 20, min: 28, loc: 0, mode: 'dinein', table: 3, itemsIdx: [0, 8], payMethod: 0, status: 'preparing', isLiveActive: true },
      { hour: 20, min: 38, loc: 1, mode: 'delivery', itemsIdx: [2, 7], payMethod: 2, status: 'onway', isLiveActive: true },
      { hour: 20, min: 45, loc: 1, mode: 'dinein', table: 7, itemsIdx: [4, 6], payMethod: 1, status: 'preparing', isLiveActive: true },
    ];

    const generateOrder = (
      day: string,
      dayBaseTime: number,
      conf: (typeof schedule)[0],
      idx: number,
    ): ServerOrder => {
      const orderNumber = orderNum++;
      const cust = sampleCustomers[idx % sampleCustomers.length];
      const placed = dayBaseTime + conf.hour * 3600000 + conf.min * 60000;
      const target = placed + 15 * 60000;

      const items: OrderLine[] = conf.itemsIdx.map((dishIdx) => {
        const d = dishes[dishIdx];
        return {
          id: d.id,
          name: d.name,
          cat: d.cat,
          station: d.station,
          qty: 1,
          sel: {},
          opts: '',
          unit: d.price,
          total: d.price,
          done: !conf.isLiveActive || conf.status === 'ready' || conf.status === 'onway',
        };
      });

      const subtotal = items.reduce((acc, i) => acc + i.total, 0);
      const deliveryFee = conf.mode === 'delivery' ? (subtotal >= 3000 ? 0 : 250) : 0;
      // 5% concessional tax for card/wallet, 16% for cash
      const taxRate = conf.payMethod === 0 ? 0.16 : 0.05;
      const tax = Math.round(subtotal * taxRate);
      const total = subtotal + deliveryFee + tax;

      const stations: ServerOrder['stations'] = {};
      if (items.some((i) => i.station === 'bar')) {
        stations.bar = conf.isLiveActive && conf.status === 'preparing' ? 'making' : 'done';
      }
      if (items.some((i) => i.station === 'kitchen')) {
        stations.kitchen = conf.isLiveActive && conf.status === 'preparing' ? 'making' : 'done';
      }

      const events: OrderEvent[] = [
        { t: placed, what: 'placed', status: 'received', by: cust.name },
        { t: placed + 30000, what: 'accepted', status: 'accepted', by: 'Auto-accept' },
      ];

      if (conf.status !== 'received' && conf.status !== 'accepted') {
        events.push({ t: placed + 60000, what: 'preparing', status: 'preparing', by: 'Kitchen Station' });
      }
      if (conf.status === 'ready' || conf.status === 'served' || conf.status === 'collected' || conf.status === 'onway' || conf.status === 'delivered') {
        events.push({ t: placed + 600000, what: 'ready', status: 'ready', by: 'Pass Counter' });
      }
      if (conf.status === 'onway' || conf.status === 'delivered') {
        events.push({ t: placed + 720000, what: 'onway', status: 'onway', by: 'Bilal (Rider)' });
      }
      if (conf.status === 'delivered') {
        events.push({ t: placed + 1500000, what: 'delivered', status: 'delivered', by: 'Bilal (Rider)' });
      }
      if (conf.status === 'collected') {
        events.push({ t: placed + 800000, what: 'collected', status: 'collected', by: 'Cashier' });
      }
      if (conf.status === 'served') {
        events.push({ t: placed + 650000, what: 'served', status: 'served', by: 'Floor Waiter' });
      }

      const rider = conf.mode === 'delivery' ? { id: 'st_rider_1', name: 'Bilal Rider', plate: 'LEA-9988' } : null;
      const isPaid = !conf.isLiveActive || conf.payMethod !== 0;

      return {
        number: orderNumber,
        day,
        placed,
        target,
        mode: conf.mode,
        loc: conf.loc,
        area: conf.mode === 'delivery' ? (conf.loc === 0 ? 0 : 1) : null,
        table: conf.mode === 'dinein' ? conf.table || 1 : null,
        address: conf.mode === 'delivery' ? 'Street 14, Block Y, Phase 3, Lahore' : '',
        name: conf.mode === 'dinein' ? `Table ${conf.table || 1} · ${cust.name}` : cust.name,
        phone: cust.phone,
        email: `${cust.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        note: idx % 3 === 0 ? 'Less sugar please' : '',
        pay: conf.payMethod,
        items,
        totals: {
          sub: subtotal,
          discount: 0,
          promo: 0,
          reward: 0,
          fee: deliveryFee,
          rate: taxRate,
          tax,
          total,
        },
        promoCode: idx % 4 === 0 ? 'BREWNS10' : '',
        pickupAt: { t: placed + 900000, tomorrow: false },
        status: conf.status,
        stations,
        events,
        messages: [],
        readByCafe: 0,
        rider,
        paid: isPaid ? { t: placed, by: 'Register POS', method: conf.payMethod } : null,
        source: conf.mode === 'dinein' ? 'table' : idx % 2 === 0 ? 'online' : 'counter',
        takenBy: { id: 'st_cashier_1', name: 'Usman Cashier' },
        customerId: null,
        key: `key_${orderNumber}`,
        club: { stamps: items.filter((i) => i.cat === 'drinks').length, used: false, verified: true },
        demo: true,
      };
    };

    // Seed today's orders
    for (let i = 0; i < schedule.length; i++) {
      const conf = schedule[i];
      const order = generateOrder(today, midnight, conf, i);
      await kv.hset(`orders:day:${today}`, order.number, order);
      await kv.hset('orders:where', order.number, today);
      if (conf.isLiveActive || (order.mode === 'dinein' && !order.paid)) {
        await kv.hset('orders:active', order.number, order);
      }
      totalCreated++;
    }

    // Seed historical days for comparisons (Yesterday and 7 days ago)
    for (const histDay of [pkDay(now - D), pkDay(now - 7 * D)]) {
      const histMidnight = pkMidnight(now - (histDay === pkDay(now - D) ? D : 7 * D));
      for (let i = 0; i < schedule.length - 4; i++) {
        const conf = { ...schedule[i], status: (schedule[i].mode === 'delivery' ? 'delivered' : schedule[i].mode === 'dinein' ? 'served' : 'collected') as Status, isLiveActive: false };
        const order = generateOrder(histDay, histMidnight, conf, i + 5);
        await kv.hset(`orders:day:${histDay}`, order.number, order);
        await kv.hset('orders:where', order.number, histDay);
        totalCreated++;
      }
    }

    // Add a live table call for Table 3 on MM Alam Road
    const tableCalls = [
      { id: 'call_demo_1', loc: 0, table: 3, kind: 'bill', t: now - 3 * 60000, demo: true },
    ];
    await kv.set('calls:open', tableCalls);

    // Save demo days tracker
    await kv.set('demo:days', daysToSeed);
    await bumpLive();

    return { created: totalCreated, days: daysToSeed };
  });
}
