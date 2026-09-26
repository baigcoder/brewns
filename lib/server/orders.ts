/* Orders on the server: placing them, moving them through the café, and who
   may do which step.

   Storage: each Lahore day is a hash of its orders (orders:day:YYYY-MM-DD, for
   history and reports), open orders are also kept in orders:active (what the
   kitchen, floor and riders read every few seconds), and orders:where maps an
   order number to its day. Every change bumps `live:v`, so the console's poll
   is one tiny read when nothing has happened. */

import { catalogItem, CLOSE_MIN, DELIVERY, OPEN_MIN, PAY, PREP_MIN, selLabel, SHOP_COUNT, unitPrice, validSel } from '@/lib/catalog';
import {
  customerStage,
  FLOW,
  isOpen,
  pkDay,
  pkMidnight,
  pkMinutes,
  stageTimes,
  stationFor,
  stationsOf,
  statusAfterStations,
  STATUS_LABEL,
  type Mode,
  type OrderLine,
  type ServerOrder,
  type Station,
  type Status,
} from '@/lib/orderFlow';
import { priceOrder } from '@/lib/pricing';
import { rewardValue } from '@/components/brewns/club';
import { can, canAny, type Permission } from '@/lib/rbac';
import { audit, type Actor } from './audit';
import { allUsers, randomToken, worksAt, type StaffContext, type User } from './auth';
import { addCustomerOrder, creditOrder, reverseCredit } from './customers';
import { fail } from './http';
import { getSettings, type Settings } from './settings';
import { kv, withLock } from './store';

const dayKey = (day: string) => `orders:day:${day}`;
export const bumpLive = () => kv.incr('live:v');
export const liveVersion = () => kv.num('live:v');

export async function getOrder(number: number): Promise<ServerOrder | null> {
  const active = await kv.hget<ServerOrder>('orders:active', number);
  if (active) return active;
  const day = await kv.hget<string>('orders:where', number);
  return day ? kv.hget<ServerOrder>(dayKey(day), number) : null;
}

/** Open orders, and table orders not yet paid, stay on the live boards. */
const staysActive = (o: ServerOrder) => o.status !== 'cancelled' && (isOpen(o.status) || (o.mode === 'dinein' && !o.paid));

export async function saveOrder(o: ServerOrder) {
  o.events = o.events.slice(-80);
  o.messages = o.messages.slice(-120);
  await kv.hset(dayKey(o.day), o.number, o);
  if (staysActive(o)) await kv.hset('orders:active', o.number, o);
  else await kv.hdel('orders:active', o.number);
  await bumpLive();
}

export const activeOrders = async () => Object.values(await kv.hall<ServerOrder>('orders:active')).sort((a, b) => a.placed - b.placed);

/** Every order on these Lahore days, in one round trip. */
export const ordersOn = async (days: string[]) => (await kv.hallMany<ServerOrder>(days.map(dayKey))).flat();

/* ── placing an order ── */

export type OrderInput = {
  items: { id: string; qty: number; sel: Record<string, number> }[];
  mode: Mode;
  loc: number;
  area: number | null;
  table: number | null;
  address: string;
  when: 'asap' | { t: number; tomorrow: boolean };
  name: string;
  phone: string;
  email: string;
  note: string;
  pay: number;
  promo: string;
  useReward: boolean;
};

export type Placer =
  | { kind: 'online'; customer: User | null; guestReward: boolean }
  | { kind: 'staff'; ctx: StaffContext; source: 'counter' | 'table' };

export const isOpenAt = (t: number, lead = PREP_MIN) => pkMinutes(t) >= OPEN_MIN && pkMinutes(t) + lead <= CLOSE_MIN;

export async function placeOrder(input: OrderInput, by: Placer) {
  const settings = await getSettings();
  const online = by.kind === 'online';
  if (online && !settings.online) fail(503, 'Online orders are switched off right now.');
  if (!(input.loc >= 0 && input.loc < SHOP_COUNT)) fail(400, 'Pick a shop.');
  const mode = input.mode;
  if (!FLOW[mode]) fail(400, 'Pickup, delivery or table?');

  let loc = input.loc;
  if (mode === 'delivery') {
    if (input.area === null || !DELIVERY.areas[input.area]) fail(400, 'Pick a delivery area.');
    loc = DELIVERY.areas[input.area!][1];
  }
  if (by.kind === 'staff' && !worksAt(by.ctx.user, loc)) fail(403, "You don't work at that shop.");
  const shop = settings.shops[loc];
  if (online && shop.paused) fail(409, 'This shop has paused online orders for a little while. Try another shop, or order at the counter.');
  if (mode === 'dinein' && !(input.table && input.table >= 1 && input.table <= shop.tables)) fail(400, 'Which table?');

  // Every line priced again from the catalog.
  if (!Array.isArray(input.items) || !input.items.length) fail(400, 'The bag is empty.');
  if (input.items.length > 40) fail(400, 'That is a lot of lines. Call us for big orders.');
  const items: OrderLine[] = input.items.map((it) => {
    const p = catalogItem(String(it?.id));
    if (!p) return fail(400, 'Something in the bag is no longer on the menu.') as never;
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 30) fail(400, `How many ${p.name.toLowerCase()}?`);
    if (!validSel(p, it.sel)) fail(400, `Choose the options for ${p.name.toLowerCase()} again.`);
    if (settings.soldOut.includes(p.id)) fail(409, `Sorry, ${p.name.toLowerCase()} has just sold out. Take it out of the bag to carry on.`);
    const unit = unitPrice(p, it.sel);
    return { id: p.id, qty, sel: it.sel, name: p.name, opts: selLabel(p, it.sel), unit, total: unit * qty, cat: p.cat, station: stationFor(p.cat) };
  });
  if (mode === 'dinein' && items.some((i) => i.cat === 'gifts')) fail(400, 'Gift cards are sold online or at the counter, not to a table.');

  // Who it's for.
  const name = String(input.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim().slice(0, 80);
  if (online) {
    if (name.length < 2) fail(400, 'Tell us who to call out.');
    if (!phone) fail(400, 'Add a Pakistani mobile, like 0300 1234567.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'That email looks off.');
  }
  const address = mode === 'delivery' ? String(input.address || '').trim().slice(0, 160) : '';
  if (mode === 'delivery' && address.length < 10) fail(400, 'House, street and block, so the rider finds you.');
  const pay = Number.isInteger(input.pay) && input.pay >= 0 && input.pay < PAY.length ? input.pay : 0;

  // When.
  const now = Date.now();
  const lead = (mode === 'delivery' ? DELIVERY.areas[input.area!][3] : PREP_MIN) + (shop.extraMin || 0);
  let target: number;
  let pickupAt: { t: number; tomorrow: boolean };
  if (input.when === 'asap' || mode === 'dinein' || !online) {
    if (online && !isOpenAt(now)) fail(409, "We're closed right now. Schedule it for when we open.");
    target = now + lead * 60000;
    pickupAt = { t: pkMinutes(target), tomorrow: pkDay(target) !== pkDay(now) };
  } else {
    const t = Number(input.when?.t);
    const tomorrow = !!input.when?.tomorrow;
    if (!Number.isInteger(t) || t % 15 || t < OPEN_MIN + 15 || t > CLOSE_MIN - 15) fail(400, 'Pick one of the times on offer.');
    target = pkMidnight(now) + (tomorrow ? 86400000 : 0) + t * 60000;
    if (target < now + PREP_MIN * 60000) fail(400, 'That time has passed. Pick a later one.');
    if (target > now + 2 * 86400000) fail(400, 'We take orders up to a day ahead.');
    pickupAt = { t, tomorrow };
  }

  // Money: promo, the club's free drink, then tax.
  const code = String(input.promo || '').trim().toUpperCase().slice(0, 24);
  const promo = code ? settings.promos.find((p) => p.active && p.code === code) : undefined;
  if (code && !promo && online) fail(400, "That promo code isn't valid any more. Remove it to carry on.");
  const customer = by.kind === 'online' ? by.customer : null;
  const memberRewards = customer?.club?.member ? customer.club.rewards : 0;
  const wantsReward = !!input.useReward && rewardValue(items) > 0;
  const verified = !!customer && memberRewards > 0;
  const useReward = wantsReward && (verified || (by.kind === 'online' && by.guestReward));
  const totals = priceOrder(items, { mode, area: input.area, pay, promoPct: promo ? promo.pct / 100 : 0, useReward });
  if (mode === 'delivery' && online && totals.sub - totals.discount < DELIVERY.min) fail(400, `Delivery starts at Rs ${DELIVERY.min.toLocaleString('en-US')}.`);

  const number = await nextNumber();
  const stations = Object.fromEntries(stationsOf(items).map((s) => [s, 'queued'])) as ServerOrder['stations'];
  const staffActor = by.kind === 'staff' ? by.ctx.user : null;
  const auto = shop.autoAccept || by.kind === 'staff';
  const o: ServerOrder = {
    number,
    day: pkDay(now),
    placed: now,
    target,
    mode,
    loc,
    area: mode === 'delivery' ? input.area : null,
    table: mode === 'dinein' ? input.table : null,
    address,
    name: name || (mode === 'dinein' ? `Table ${input.table}` : 'Walk-in'),
    phone,
    email,
    note: String(input.note || '').trim().slice(0, 140),
    pay,
    items,
    totals,
    promoCode: promo?.code || '',
    pickupAt,
    status: 'received',
    stations,
    events: [{ t: now, what: 'placed', status: 'received', by: staffActor?.name || (online ? 'Customer' : ''), role: staffActor?.role }],
    messages: [],
    readByCafe: 0,
    rider: null,
    paid: null,
    source: by.kind === 'staff' ? by.source : mode === 'dinein' ? 'table' : 'online',
    takenBy: staffActor ? { id: staffActor.id, name: staffActor.name } : null,
    customerId: customer?.id || null,
    key: randomToken(16),
    club: useReward ? { stamps: 0, used: true, verified } : null,
  };
  if (auto) {
    // Straight to the stations; beans, merch and gift cards alone are ready to hand over.
    o.status = 'accepted';
    o.events.push({ t: now, what: 'accepted', status: 'accepted', by: staffActor ? staffActor.name : 'Auto-accept' });
    if (!Object.keys(stations).length) {
      o.status = 'ready';
      o.events.push({ t: now, what: 'ready', status: 'ready', by: 'Counter' });
    }
  }
  await kv.hset('orders:where', number, o.day);
  if (promo) await kv.incr(`promo-uses:${promo.code}`);

  let credit: Awaited<ReturnType<typeof creditOrder>> = null;
  if (customer) {
    credit = await creditOrder(customer.id, { number, placed: now, lines: items, usedReward: useReward && verified });
    if (credit) o.club = { stamps: credit.stamps, used: credit.used, verified: true };
    await addCustomerOrder(customer.id, { number, day: o.day, placed: now, total: totals.total, mode, lines: items.map(({ cat, qty, unit }) => ({ cat, qty, unit })) });
  }
  await saveOrder(o);
  if (staffActor) await audit(staffActor, `Took order #${number}`, `${o.mode === 'dinein' ? `Table ${o.table}` : o.name} · Rs ${totals.total}`);
  return { order: o, credit };
}

async function nextNumber() {
  await kv.set('seq:order', 1000, { nx: true });
  return kv.incr('seq:order');
}

/* ── what the customer sees ── */

export const publicOrder = (o: ServerOrder) => ({
  number: o.number,
  status: o.status,
  statusLabel: STATUS_LABEL[o.status],
  stage: customerStage(o),
  times: stageTimes(o),
  placed: o.placed,
  target: o.target,
  mode: o.mode,
  loc: o.loc,
  area: o.area,
  table: o.table,
  // The customer's own details, for rebuilding the receipt on another device (the key guards them).
  name: o.name,
  phone: o.phone,
  address: o.address,
  note: o.note,
  pay: o.pay,
  pickupAt: o.pickupAt,
  promoCode: o.promoCode,
  rider: o.rider ? { name: o.rider.name, plate: o.rider.plate } : null,
  messages: o.messages,
  cancelled: o.status === 'cancelled' ? { t: o.events.findLast((e) => e.status === 'cancelled')?.t || Date.now(), reason: o.cancelReason || '' } : null,
  paid: !!o.paid,
  totals: o.totals,
  items: o.items.map(({ id, qty, sel, name, opts, unit, total }) => ({ id, qty, sel, name, opts, unit, total })),
});

/* ── what each role sees ── */

/**
 * An order as a staff member may see it. The kitchen gets the tickets without
 * the customer's phone or address; a rider sees those only for deliveries that
 * are theirs. The tracking key never leaves the server.
 */
export function staffView(o: ServerOrder, ctx: StaffContext) {
  const { key: _key, ...rest } = o;
  const full = can(ctx.perms, 'orders.view') || (o.rider?.id === ctx.user.id && can(ctx.perms, 'delivery.ride')) || can(ctx.perms, 'delivery.assign');
  if (full) return rest;
  const floor = can(ctx.perms, 'floor.tables') && o.mode === 'dinein';
  return { ...rest, phone: floor ? rest.phone : '', email: '', address: o.mode === 'delivery' ? DELIVERY.areas[o.area ?? 0]?.[0] || '' : '', messages: [] };
}

/** Which active orders a staff member's screens show at all. */
export function visibleTo(o: ServerOrder, ctx: StaffContext) {
  if (!worksAt(ctx.user, o.loc)) return false;
  const p = ctx.perms;
  if (canAny(p, 'orders.view', 'orders.manage', 'delivery.assign')) return true;
  if (canAny(p, 'kitchen.bar', 'kitchen.food') && Object.keys(o.stations).length) return true;
  if (can(p, 'floor.tables') && (o.mode === 'dinein' || o.status === 'ready')) return true;
  if (can(p, 'delivery.ride') && o.mode === 'delivery' && (!o.rider || o.rider.id === ctx.user.id)) return true;
  return false;
}

/* ── moving an order along ── */

export type Action =
  | { type: 'accept' }
  | { type: 'station'; station: Station; state: 'queued' | 'making' | 'done' }
  | { type: 'line'; index: number; done: boolean }
  | { type: 'ready' }
  | { type: 'collected' }
  | { type: 'served' }
  | { type: 'paid'; method: number }
  | { type: 'assign'; riderId: string }
  | { type: 'take' }
  | { type: 'pickup' }
  | { type: 'arriving' }
  | { type: 'delivered' }
  | { type: 'delay'; min: number }
  | { type: 'cancel'; reason: string }
  | { type: 'message'; text: string }
  | { type: 'read' };

const stationPerm = (s: Station): Permission => (s === 'kitchen' ? 'kitchen.food' : 'kitchen.bar');

export async function staffAct(number: number, action: Action, ctx: StaffContext) {
  return withLock(`order:${number}`, async () => {
    const o = await getOrder(number);
    if (!o) return fail(404, 'No such order.') as never;
    if (!worksAt(ctx.user, o.loc)) fail(403, "That order is at a shop you don't work at.");
    const actor: Actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
    const need = (...p: Permission[]) => {
      if (!canAny(ctx.perms, ...p)) fail(403, "Your role doesn't allow that. Ask the owner if you need it.");
    };
    const when = (ok: boolean, msg = `It's already ${STATUS_LABEL[o.status].toLowerCase()}.`) => {
      if (!ok) fail(409, msg);
    };
    const ownRide = o.rider?.id === ctx.user.id && can(ctx.perms, 'delivery.ride');
    const move = (status: Status, what: string = status) => {
      o.status = status;
      o.events.push({ t: Date.now(), what, status, by: ctx.user.name, role: ctx.role });
    };
    const note = (what: string) => o.events.push({ t: Date.now(), what, by: ctx.user.name, role: ctx.role });
    let log = '';

    switch (action.type) {
      case 'accept':
        need('orders.manage');
        when(o.status === 'received');
        move(Object.keys(o.stations).length ? 'accepted' : 'ready', 'accepted');
        log = 'Accepted';
        break;
      case 'station': {
        const s = action.station;
        if (!(s in o.stations)) fail(400, 'Nothing on this order for that station.');
        need(stationPerm(s), 'orders.manage');
        when(['received', 'accepted', 'preparing', 'ready'].includes(o.status));
        if (!['queued', 'making', 'done'].includes(action.state)) fail(400, 'Unknown state.');
        if (o.status === 'received') move('accepted');
        o.stations[s] = action.state;
        if (action.state === 'done') o.items.forEach((i) => i.station === s && (i.done = true));
        if (action.state === 'queued') o.items.forEach((i) => i.station === s && (i.done = false));
        note(`${s}:${action.state}`);
        // Back to making if a done station was reopened, forward once every station is done.
        if (o.status === 'ready' && action.state !== 'done') o.status = 'preparing';
        const next = statusAfterStations(o);
        if (next !== o.status) move(next);
        break;
      }
      case 'line': {
        const line = o.items[action.index];
        if (!line) fail(400, 'No such line.');
        need(stationPerm(line.station), 'orders.manage');
        when(isOpen(o.status));
        line.done = !!action.done;
        break;
      }
      case 'ready':
        need('orders.manage');
        when(['received', 'accepted', 'preparing'].includes(o.status));
        for (const s of Object.keys(o.stations) as Station[]) o.stations[s] = 'done';
        move('ready');
        log = 'Marked ready';
        break;
      case 'collected':
        need('orders.manage');
        when(o.mode === 'pickup' && o.status === 'ready', 'Only a ready pickup can be handed over.');
        move('collected');
        o.paid ||= { t: Date.now(), by: ctx.user.name, method: o.pay };
        log = 'Handed over';
        break;
      case 'served':
        need('floor.tables', 'orders.manage');
        when(o.mode === 'dinein' && o.status === 'ready', 'Only a ready table order can be served.');
        move('served');
        break;
      case 'paid': {
        if (!ownRide) need('orders.pay');
        when(o.status !== 'cancelled' && !o.paid, o.paid ? 'Already paid.' : 'This order was cancelled.');
        const method = Number.isInteger(action.method) && action.method >= 0 && action.method < PAY.length ? action.method : o.pay;
        o.paid = { t: Date.now(), by: ctx.user.name, method };
        note('paid');
        log = `Took payment · ${PAY[method][0]} · Rs ${o.totals.total}`;
        break;
      }
      case 'assign':
      case 'take': {
        when(o.mode === 'delivery' && ['received', 'accepted', 'preparing', 'ready'].includes(o.status), 'Only a delivery that has not left can get a rider.');
        let rider: User | undefined;
        if (action.type === 'take') {
          need('delivery.ride');
          when(!o.rider || o.rider.id === ctx.user.id, `${o.rider?.name} already has it.`);
          rider = ctx.user;
        } else {
          need('delivery.assign');
          rider = (await allUsers('staff')).find((u) => u.id === action.riderId && u.active && u.role === 'rider');
          if (!rider) fail(400, 'Pick an active rider.');
          if (!worksAt(rider!, o.loc)) fail(400, `${rider!.name} doesn't ride for that shop.`);
        }
        o.rider = { id: rider!.id, name: rider!.name, plate: rider!.plate || '' };
        note('rider');
        log = `Gave the delivery to ${rider!.name}`;
        break;
      }
      case 'pickup':
        if (!ownRide) need('orders.manage');
        when(!!o.rider && o.status === 'ready', o.rider ? 'It isn’t ready to leave yet.' : 'Assign a rider first.');
        move('onway');
        break;
      case 'arriving':
        if (!ownRide) need('orders.manage');
        when(o.status === 'onway');
        move('arriving');
        break;
      case 'delivered':
        if (!ownRide) need('orders.manage');
        when(o.status === 'onway' || o.status === 'arriving', 'It has to be on the road first.');
        move('delivered');
        o.paid ||= { t: Date.now(), by: ctx.user.name, method: o.pay };
        log = 'Delivered';
        break;
      case 'delay': {
        need('orders.manage');
        when(isOpen(o.status));
        const min = [5, 10, 15, 30].includes(action.min) ? action.min : 5;
        o.target = Math.max(o.target, Date.now()) + min * 60000;
        o.pickupAt = { t: pkMinutes(o.target), tomorrow: pkDay(o.target) !== o.day };
        note(`delay:${min}`);
        o.messages.push({ id: randomToken(6), from: 'cafe', text: `Sorry, we're running about ${min} minutes behind. Your new time is ${String(Math.floor(o.pickupAt.t / 60)).padStart(2, '0')}:${String(o.pickupAt.t % 60).padStart(2, '0')}.`, t: Date.now(), by: ctx.user.name });
        log = `Pushed back ${min} min`;
        break;
      }
      case 'cancel': {
        need('orders.manage');
        when(isOpen(o.status), 'It has already been handed over.');
        o.cancelReason = String(action.reason || '').trim().slice(0, 140) || 'Cancelled by the café';
        move('cancelled');
        if (o.customerId && o.club) await reverseCredit(o.customerId, o.number, o.club.stamps, o.club.used && o.club.verified);
        log = `Cancelled · ${o.cancelReason}`;
        break;
      }
      case 'message': {
        if (!ownRide) need('messages.reply');
        const text = String(action.text || '').trim().slice(0, 300);
        if (!text) fail(400, 'Write something first.');
        o.messages.push({ id: randomToken(6), from: ctx.role === 'rider' ? 'rider' : 'cafe', text, t: Date.now(), by: ctx.user.name });
        o.readByCafe = o.messages.filter((m) => m.from === 'you').length;
        break;
      }
      case 'read':
        need('orders.view', 'messages.reply', 'delivery.ride');
        o.readByCafe = o.messages.filter((m) => m.from === 'you').length;
        break;
      default:
        fail(400, 'Unknown action.');
    }
    await saveOrder(o);
    if (log) await audit(actor, `${log} · #${o.number}`, o.mode === 'dinein' ? `Table ${o.table} · ${o.name}` : o.name);
    return o;
  });
}

/* ── what the customer can do ── */

export async function customerAct(number: number, key: string, action: { type: 'cancel' | 'collected' | 'message'; text?: string }) {
  return withLock(`order:${number}`, async () => {
    const o = await getOrder(number);
    if (!o || !key || o.key !== key) return fail(404, 'No such order.') as never;
    const t = Date.now();
    if (action.type === 'cancel') {
      if (!['received', 'accepted'].includes(o.status) || Object.values(o.stations).some((s) => s !== 'queued'))
        fail(409, "It's already being made, so it can't be cancelled here. Call the shop if something's wrong.");
      o.status = 'cancelled';
      o.cancelReason = 'Cancelled by the customer';
      o.events.push({ t, what: 'cancelled', status: 'cancelled', by: 'Customer' });
      if (o.customerId && o.club) await reverseCredit(o.customerId, o.number, o.club.stamps, o.club.used && o.club.verified);
    } else if (action.type === 'collected') {
      if (o.mode !== 'pickup' || o.status !== 'ready') fail(409, 'It isn’t ready yet.');
      o.status = 'collected';
      o.events.push({ t, what: 'collected', status: 'collected', by: 'Customer' });
    } else if (action.type === 'message') {
      const text = String(action.text || '').trim().slice(0, 300);
      if (!text) fail(400, 'Write something first.');
      if (o.messages.filter((m) => m.from === 'you').length >= 40) fail(429, 'Please call the shop instead.');
      o.messages.push({ id: randomToken(6), from: 'you', text, t });
    } else fail(400, 'Unknown action.');
    await saveOrder(o);
    return o;
  });
}

/* ── waiter calls from tables ── */

export type Call = { id: string; loc: number; table: number; kind: 'waiter' | 'bill'; t: number };

export async function callWaiter(loc: number, table: number, kind: Call['kind'], settings: Settings) {
  if (!(loc >= 0 && loc < SHOP_COUNT)) fail(400, 'Which shop?');
  if (!(table >= 1 && table <= settings.shops[loc].tables)) fail(400, 'Which table?');
  const id = `${loc}-${table}-${kind}`;
  const call: Call = { id, loc, table, kind, t: Date.now() };
  await kv.hset('calls', id, call);
  await bumpLive();
  return call;
}

export const openCalls = async () => Object.values(await kv.hall<Call>('calls')).sort((a, b) => a.t - b.t);

export async function answerCall(id: string, ctx: StaffContext) {
  const call = await kv.hget<Call>('calls', id);
  if (!call) return;
  if (!worksAt(ctx.user, call.loc)) fail(403, "That table is at a shop you don't work at.");
  await kv.hdel('calls', id);
  await bumpLive();
}
