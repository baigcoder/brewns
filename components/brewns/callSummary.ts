/* What Sarah has understood so far on a call, shown beside the conversation:
   delivery or pickup, the items building up, where it's going, and any
   complaint. It fills in from the tools she calls (what she passed them is
   what she understood) and from what the server confirms back. */

import { LOC_TITLES } from '@/lib/catalog';

export type CallPurpose = 'order' | 'complaint';
type Line = { id: string; name: string; qty: number };
export type CallSummary = {
  purpose: CallPurpose;
  kind?: 'delivery' | 'pickup' | 'table' | 'party';
  items: Line[];
  where?: string;
  issue?: string;
  status?: string;
};

export const emptySummary = (purpose: CallPurpose = 'order'): CallSummary => ({ purpose, items: [] });

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const shop = (v: unknown) => (typeof v === 'number' ? LOC_TITLES[v] : undefined);
const booking = (a: Record<string, any>, loc: unknown) => [a.guests ? `${a.guests} guests` : '', shop(loc), [text(a.date), text(a.time)].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

function lines(items: unknown, nameOf: (id: string) => string): Line[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((l) => l && typeof l.id === 'string')
    .map((l) => ({ id: l.id, name: text(l.name) || nameOf(l.id) || l.id, qty: Math.max(1, Number(l.qty) || 1) }));
}

/** The same item twice adds up, as a bag would. */
function merge(into: Line[], add: Line[]) {
  const out = into.map((l) => ({ ...l }));
  for (const l of add) {
    const had = out.find((x) => x.id === l.id);
    if (had) had.qty += l.qty;
    else out.push(l);
  }
  return out;
}

/** A tool Sarah just called, with what she passed it. */
export function noteTool(sum: CallSummary, name: string, args: Record<string, any>, nameOf: (id: string) => string): CallSummary {
  const s = { ...sum };
  if (name === 'add_to_bag') s.items = merge(s.items, lines(args.items, nameOf));
  else if (name === 'place_order') {
    // The whole order, read back and confirmed: it replaces what was building up.
    const all = lines(args.items, nameOf);
    if (all.length) s.items = all;
    if (args.mode === 'delivery' || args.mode === 'pickup') s.kind = args.mode;
    s.where = s.kind === 'pickup' ? shop(args.shop) || s.where : text(args.address) || s.where;
  } else if (name === 'check_table' || name === 'reserve_table' || name === 'book_party') {
    s.kind = name === 'book_party' ? 'party' : 'table';
    s.where = booking(args, args.shop) || s.where;
  } else if (name === 'request_callback') s.issue = text(args.reason) || s.issue;
  return s;
}

/** What the server confirmed. `fromLive` is set when the tool call was already noted,
    so a bag line isn't counted twice. */
export function noteAction(sum: CallSummary, action: { type: string; data?: any }, nameOf: (id: string) => string, fromLive: boolean): CallSummary {
  const s = { ...sum };
  const d = action.data || {};
  if (action.type === 'ADD_TO_BAG') {
    if (!fromLive) s.items = merge(s.items, lines(d.items, nameOf));
    s.status = 'bag';
  } else if (action.type === 'ORDER_PLACED' && d.order) {
    const o = d.order;
    const all = lines(o.items, nameOf);
    if (all.length) s.items = all;
    if (o.mode === 'delivery' || o.mode === 'pickup') s.kind = o.mode;
    s.where = o.mode === 'delivery' ? text(o.address) || s.where : shop(o.loc) || s.where;
    s.status = `order:${o.number}`;
  } else if (action.type === 'RESERVE_TABLE' || action.type === 'BOOK_PARTY') {
    s.kind = action.type === 'BOOK_PARTY' ? 'party' : 'table';
    s.where = booking(d, d.loc ?? d.shop) || s.where;
    s.status = `booked:${d.code || ''}`;
  } else if (action.type === 'CALLBACK') {
    s.issue = text(d.reason) || s.issue;
    s.status = 'callback';
  }
  return s;
}

const WORDS = {
  en: {
    about: 'About', order: 'Order', complaint: 'Complaint', delivery: 'Delivery', pickup: 'Pickup', table: 'Table booking', party: 'Party booking',
    items: 'Items', where: (k?: string) => (k === 'delivery' ? 'Address' : k === 'pickup' ? 'Counter' : k ? 'Table' : 'Where'), issue: 'Issue', status: 'Status',
    bag: 'Added to your bag', callback: 'The team will call you back', placed: (n: string) => `Order #${n} placed`, booked: (c: string) => `Booked${c ? ` · ${c}` : ''}`,
  },
  ur: {
    about: 'بارے میں', order: 'آرڈر', complaint: 'شکایت', delivery: 'ڈیلیوری', pickup: 'پک اپ', table: 'ٹیبل بکنگ', party: 'پارٹی بکنگ',
    items: 'آئٹمز', where: (k?: string) => (k === 'delivery' ? 'پتہ' : k === 'pickup' ? 'برانچ' : k ? 'ٹیبل' : 'جگہ'), issue: 'مسئلہ', status: 'صورتحال',
    bag: 'بیگ میں شامل', callback: 'ٹیم آپ کو واپس کال کرے گی', placed: (n: string) => `آرڈر #${n} لگ گیا`, booked: (c: string) => `بک ہو گئی${c ? ` · ${c}` : ''}`,
  },
};

/** The summary as label/value rows, in the panel's language. */
export function summaryRows(s: CallSummary, lang: 'en' | 'ur'): [string, string][] {
  const w = WORDS[lang];
  const rows: [string, string][] = [[w.about, s.kind ? w[s.kind] : w[s.purpose]]];
  if (s.items.length) rows.push([w.items, s.items.map((l) => `${l.qty}× ${title(l.name)}`).join(', ')]);
  if (s.where) rows.push([w.where(s.kind), s.where]);
  if (s.issue) rows.push([w.issue, s.issue]);
  if (s.status) {
    const [k, v = ''] = s.status.split(':');
    const label = k === 'order' ? w.placed(v.padStart(5, '0')) : k === 'booked' ? w.booked(v) : k === 'bag' ? w.bag : w.callback;
    rows.push([w.status, label]);
  }
  return rows;
}
