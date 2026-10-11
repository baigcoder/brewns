/* A cashier's shift at a glance: what they took, how it was paid, and the cash that
   should be in the drawer. Pure, so the console and the printed slip agree. */

import { PAY_KINDS } from './payments';
import type { ServerOrder, Status } from './orderFlow';

export type TillOrder = { number: number; name: string; total: number; method: number; status: Status; placed: number; mode: ServerOrder['mode']; table: number | null };

/** One time a cashier counted the drawer and closed the till. Variance is counted minus expected: negative is short. */
export type TillClose = { t: number; day: string; uid: string; name: string; orders: number; cash: number; card: number; wallet: number; refundsCash: number; float: number; expected: number; counted: number; variance: number; note: string };

/** A drawer this far short (in rupees) is worth telling the owner about at once. */
export const SHORT_ALERT = 200;

export const varianceLabel = (v: number) => (v === 0 ? 'Exact' : v < 0 ? `Short Rs ${(-v).toLocaleString('en-US')}` : `Over Rs ${v.toLocaleString('en-US')}`);

export type Till = {
  orders: number;
  cash: number;
  card: number;
  wallet: number;
  /** Cash handed back to customers as refunds by this cashier. */
  refundsCash: number;
  float: number;
  /** Cash that should be in the drawer: float + cash sales − cash refunds paid out. */
  drawer: number;
  recent: TillOrder[];
};

/** `orders` are the day's orders at the shops this person works at. `since` is when they last closed the till: only payments after that count. */
export function tillSummary(orders: ServerOrder[], me: { id: string; name: string }, float = 0, since = 0): Till {
  const mine = orders.filter((o) => o.paid && o.paid.t > since && (o.paid.byId ? o.paid.byId === me.id : o.paid.by === me.name));
  const sold = mine.filter((o) => o.status !== 'cancelled');
  const sum = (kind: (typeof PAY_KINDS)[number]) => sold.filter((o) => PAY_KINDS[o.paid!.method] === kind).reduce((s, o) => s + o.totals.total, 0);
  const refundsCash = orders.reduce((s, o) => s + (o.refund?.state === 'paid' && o.refund.method === 0 && o.refund.paidBy === me.name && (o.refund.paidAt ?? 0) > since ? o.refund.amount : 0), 0);
  const cash = sum('cash');
  const f = Number.isInteger(float) && float > 0 ? float : 0;
  return {
    orders: sold.length,
    cash,
    card: sum('card'),
    wallet: sum('wallet'),
    refundsCash,
    float: f,
    drawer: f + cash - refundsCash,
    recent: [...mine]
      .sort((a, b) => b.placed - a.placed)
      .slice(0, 8)
      .map((o) => ({ number: o.number, name: o.name, total: o.totals.total, method: o.paid!.method, status: o.status, placed: o.placed, mode: o.mode, table: o.table })),
  };
}
