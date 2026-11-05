/* The moments a staff member has to act on, found by comparing one live poll
   with the one before: a new order to accept, a delivery ready with no rider,
   food ready for a table, a ticket for your station, an order running late.

   Pure: the console's RoleAlerts chimes and toasts what this returns. Each role
   gets only its own moments; the people who run orders (orders.manage) get the
   hand-offs, station and floor staff get their tickets and tables. */

import { can } from './rbac';
import { isOpen, orderNo, STATION_LABEL, type ServerOrder, type Station, type Status } from './orderFlow';

export type AlertOrder = Pick<ServerOrder, 'number' | 'status' | 'mode' | 'table' | 'name' | 'target' | 'stations' | 'messages' | 'hold'> & { rider: { id: string } | null };
export type AlertCall = { id: string; table: number; kind: 'waiter' | 'bill' };

export type AlertKind = 'accept' | 'needs-rider' | 'pickup-ready' | 'late' | 'message' | 'ticket' | 'stop' | 'serve' | 'call';
export type OrderAlert = { kind: AlertKind; number: number; text: string; tone: 'good' | 'bad' | 'plain' };

type Seen = { status: Status; rider: boolean; msgs: number; late: boolean; mine: boolean };
export type Snapshot = { orders: Map<number, Seen>; calls: Set<string> };

/** An open order this long past the time the customer was given is late enough to tell someone. */
export const LATE_MS = 10 * 60000;

const MAKING: readonly Status[] = ['received', 'accepted', 'preparing'];

/** The stations whose tickets are this person's job. */
export const myStations = (perms: readonly string[]): Station[] => [...(can(perms, 'kitchen.bar') ? ['bar' as const] : []), ...(can(perms, 'kitchen.food') ? ['kitchen' as const] : [])];

/** Does this order have something still to make at one of these stations? */
export const hasTicket = (o: Pick<AlertOrder, 'status' | 'stations' | 'hold'>, stations: Station[]) =>
  !o.hold && MAKING.includes(o.status) && o.status !== 'received' && stations.some((s) => o.stations[s] && o.stations[s] !== 'done');

export function snapshot(orders: AlertOrder[], calls: AlertCall[], perms: readonly string[], now: number): Snapshot {
  const stations = myStations(perms);
  return {
    orders: new Map(
      orders.map((o) => [
        o.number,
        { status: o.status, rider: !!o.rider, msgs: o.messages.filter((m) => m.from === 'you').length, late: isOpen(o.status) && now > o.target + LATE_MS, mine: hasTicket(o, stations) },
      ]),
    ),
    calls: new Set(calls.map((c) => c.id)),
  };
}

/** What changed since the last look that this person should hear about. The first look is not news. */
export function orderAlerts(prev: Snapshot | null, next: Snapshot, orders: AlertOrder[], calls: AlertCall[], perms: readonly string[]): OrderAlert[] {
  if (!prev) return [];
  const out: OrderAlert[] = [];
  const runs = can(perms, 'orders.manage');
  // Station and floor alerts are for the people at the station or on the floor; managers would drown in them.
  const station = !runs && myStations(perms).length > 0;
  const floor = !runs && can(perms, 'floor.tables');
  const dispatch = can(perms, 'delivery.assign');
  const rides = can(perms, 'delivery.ride') && !dispatch;
  const chats = can(perms, 'orders.view', 'messages.reply');

  for (const o of orders) {
    const was = prev.orders.get(o.number);
    const now = next.orders.get(o.number)!;
    const n = orderNo(o.number);
    const became = (s: Status) => o.status === s && was?.status !== s;
    if (runs && became('received')) out.push({ kind: 'accept', number: o.number, tone: 'good', text: o.hold ? `${n} is waiting for its advance payment. Check the transaction ID and confirm it.` : `New order ${n} · ${o.name}. Accept it to send it to the kitchen.` });
    if (o.mode === 'delivery' && o.status === 'ready' && !o.rider && (was?.status !== 'ready' || was.rider)) {
      if (dispatch) out.push({ kind: 'needs-rider', number: o.number, tone: 'bad', text: `${n} is ready at the pass and has no rider. Give it to one on Deliveries.` });
      else if (rides) out.push({ kind: 'needs-rider', number: o.number, tone: 'good', text: `${n} is ready at the pass and has no rider. Take it on Deliveries.` });
    }
    if (runs && o.mode === 'pickup' && became('ready')) out.push({ kind: 'pickup-ready', number: o.number, tone: 'plain', text: `${n} · ${o.name} is ready to hand over at the counter.` });
    if (runs && now.late && !was?.late) out.push({ kind: 'late', number: o.number, tone: 'bad', text: `${n} is more than ${LATE_MS / 60000} minutes past its time and still ${o.status === 'received' ? 'not accepted' : o.status === 'ready' ? 'waiting at the pass' : o.status === 'onway' || o.status === 'arriving' ? 'on the road' : 'being made'}.` });
    if (chats && was && now.msgs > was.msgs) out.push({ kind: 'message', number: o.number, tone: 'plain', text: `${n} · ${o.name}: “${o.messages.filter((m) => m.from === 'you').at(-1)?.text.slice(0, 80)}”` });
    if (station && now.mine && !was?.mine) {
      const what = myStations(perms).filter((s) => o.stations[s] && o.stations[s] !== 'done').map((s) => STATION_LABEL[s]).join(' and ');
      out.push({ kind: 'ticket', number: o.number, tone: 'good', text: `New ticket ${n} for the ${what.toLowerCase()}.` });
    }
    if (station && was?.mine && o.status === 'cancelled') out.push({ kind: 'stop', number: o.number, tone: 'bad', text: `${n} was cancelled. Stop making it.` });
    if (floor && o.mode === 'dinein' && became('ready')) out.push({ kind: 'serve', number: o.number, tone: 'good', text: `Table ${o.table} · ${n} is ready to serve.` });
  }
  // Cancelled orders leave the live board, so a ticket that vanished half made was cancelled (a finished one is done everywhere first).
  if (station) for (const [number, was] of prev.orders) if (was.mine && !next.orders.has(number)) out.push({ kind: 'stop', number, tone: 'bad', text: `${orderNo(number)} was cancelled. Stop making it.` });
  if (floor) for (const c of calls) if (!prev.calls.has(c.id)) out.push({ kind: 'call', number: 0, tone: 'good', text: `Table ${c.table} is asking for ${c.kind === 'bill' ? 'the bill' : 'a waiter'}.` });
  return out;
}
