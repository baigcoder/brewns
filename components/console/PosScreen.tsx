'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG, defaultSel, DELIVERY, LOC_TITLES, PAY, selLabel, unitPrice, type Product, type Sel } from '@/lib/catalog';
import { orderNo, STATUS_LABEL, type Mode } from '@/lib/orderFlow';
import { cashChoices, paymentProblem, PAY_KINDS, type Payment } from '@/lib/payments';
import { priceOrder } from '@/lib/pricing';
import { DEFAULT_BUSINESS, kitchenSlipHtml, receiptHtml, tillSlipHtml, type Business } from '@/lib/receipt';
import { SHORT_ALERT, varianceLabel, type Till, type TillClose } from '@/lib/till';
import { ago, api, rs, useNow } from './api';
import { useLive, type StaffOrder } from './Live';
import { printHtml } from './printing';
import { useMe } from './Shell';
import { useRun, useToast } from './Toasts';

const CATS = [
  ['all', 'Everything'],
  ['drinks', 'Coffee'],
  ['coolers', 'Coolers'],
  ['bakery', 'Bakery'],
  ['kitchen', 'Kitchen'],
  ['beans', 'Beans'],
  ['merch', 'Merch'],
  ['gifts', 'Gift cards'],
] as const;

const NOTE_CHIPS = ['Extra hot', 'No sugar', 'Less ice', 'No onions', 'Allergy: '];

type Line = { key: string; p: Product; sel: Sel; qty: number; note: string };

const store = {
  get: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {}
  },
};

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

/** The counter: ring up an order, take payment (cash, card or wallet), print the bill, and the kitchen gets it once it is paid. */
export function PosScreen({ startLoc, startTable }: { startLoc?: number; startTable?: number }) {
  const { me, can } = useMe();
  const { data, refresh } = useLive();
  const run = useRun();
  const toast = useToast();
  const shops = me.shops.length ? me.shops : LOC_TITLES.map((_, i) => i);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<{ p: Product; sel: Sel; qty: number } | null>(null);
  const [mode, setMode] = useState<Mode>(startTable || me.role === 'waiter' ? 'dinein' : 'pickup');
  const [loc, setLoc] = useState(startLoc !== undefined && shops.includes(startLoc) ? startLoc : shops[0]);
  const [table, setTable] = useState(startTable || 1);
  const [area, setArea] = useState(0);
  const [who, setWho] = useState({ name: '', phone: '', address: '', note: '' });
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code: string; pct: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<StaffOrder | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Read the saved choice after the first paint, so the page renders the same on the server and in the browser.
    Promise.resolve().then(() => setAutoPrint(store.get('brewns-autoprint') === '1'));
  }, []);
  const toggleAutoPrint = (on: boolean) => {
    setAutoPrint(on);
    store.set('brewns-autoprint', on ? '1' : '0');
  };

  const biz = data?.business || DEFAULT_BUSINESS;
  const soldOut = new Set(data?.soldOut || []);
  const stock = data?.stock || {};
  const inBag = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.p.id, (m.get(l.p.id) || 0) + l.qty);
    return m;
  }, [lines]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: CATALOG.length };
    for (const p of CATALOG) c[p.cat] = (c[p.cat] || 0) + 1;
    return c;
  }, []);
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATALOG.filter((p) => (cat === 'all' || p.cat === cat) && (!s || p.name.toLowerCase().includes(s)));
  }, [cat, q]);
  const tables = data?.shops[loc]?.tables || 0;

  const priced = lines.map((l) => ({ cat: l.p.cat, qty: l.qty, unit: unitPrice(l.p, l.sel) }));
  const billFor = (pay: number) => priceOrder(priced, { mode, area: mode === 'delivery' ? area : null, pay, promoPct: (promo?.pct || 0) / 100, useReward: false });
  const bill = billFor(0);
  const cardBill = billFor(1);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  const add = (p: Product, sel: Sel, qty: number) => {
    const key = `${p.id}|${JSON.stringify(sel)}`;
    setLines((ls) => (ls.some((l) => l.key === key) ? ls.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) : [...ls, { key, p, sel, qty, note: '' }]));
  };
  const choose = (p: Product) => (p.options.length ? setPick({ p, sel: defaultSel(p), qty: 1 }) : add(p, {}, 1));
  const setNote = (key: string, note: string) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, note: note.slice(0, 120) } : l)));
  const clearAll = () => {
    setLines([]);
    setPromo(null);
    setPromoInput('');
    setWho({ name: '', phone: '', address: '', note: '' });
    setNoteOpen(null);
  };

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const r = await run(() => api<{ valid: boolean; code?: string; pct?: number; reason?: string }>('/api/public/promo', { code }));
    if (!r) return;
    if (r.valid && r.code && r.pct) {
      setPromo({ code: r.code, pct: r.pct });
      toast(`${r.code} takes ${r.pct}% off.`, 'good');
    } else toast(r.reason || 'That code isn’t valid.', 'bad');
  };

  const printBill = useCallback((o: StaffOrder, reprint = false) => printHtml(receiptHtml(o, biz, { cashier: me.name, reprint })), [biz, me.name]);

  /** Sends the order. With a payment it is paid at once and reaches the kitchen; without, it waits to be paid (table and delivery). */
  const send = async (payment?: Payment) => {
    setSending(true);
    const r = await run(() =>
      api<{ order: StaffOrder }>('/api/staff/orders', {
        items: lines.map((l) => ({ id: l.p.id, qty: l.qty, sel: l.sel, note: l.note })),
        mode,
        loc,
        table: mode === 'dinein' ? table : null,
        area: mode === 'delivery' ? area : null,
        address: who.address,
        name: who.name,
        phone: who.phone,
        note: who.note,
        pay: payment?.method ?? 0,
        promo: promo?.code || '',
        ...(payment ? { payment } : {}),
      }),
    );
    setSending(false);
    if (!r) return false;
    setPaying(false);
    setDone(r.order);
    clearAll();
    refresh();
    if (payment && autoPrint) printBill(r.order);
    return true;
  };

  const shopForDelivery = DELIVERY.areas[area][1];
  const deliveryOk = mode !== 'delivery' || (who.address.trim().length >= 10 && who.phone.trim().length >= 10 && shops.includes(shopForDelivery));
  const canSend = lines.length > 0 && !sending && deliveryOk && !(mode === 'dinein' && !tables) && can('orders.create');
  const canCharge = canSend && can('orders.pay');
  const counter = mode === 'pickup';

  // Keyboard: "/" to search, F2 to charge, Escape to close what is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pick) setPick(null);
        else if (paying) setPaying(false);
        return;
      }
      if (pick || paying || done) return;
      if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F2' && canCharge) {
        e.preventDefault();
        setPaying(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, paying, done, canCharge]);

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {LOC_TITLES[mode === 'delivery' ? shopForDelivery : loc]}
          </p>
          <h1 className="cx-h1">New order</h1>
        </div>
        <label className="cx-row cx-small cx-muted" style={{ gap: 8 }}>
          <input type="checkbox" checked={autoPrint} onChange={(e) => toggleAutoPrint(e.target.checked)} /> Print the bill automatically
        </label>
      </div>

      {can('orders.pay') && <TillCard onPrintBill={printBill} biz={biz} />}

      <div className="cx-pos">
        <div className="cx-stack" style={{ gap: 14 }}>
          <div className="cx-row">
            <div className="cx-seg" role="group" aria-label="Category">
              {CATS.map(([k, label]) => (
                <button type="button" key={k} aria-pressed={cat === k} onClick={() => setCat(k)}>
                  {label}
                  <span className="cx-muted cx-small" style={{ marginLeft: 6 }}>
                    {counts[k] || 0}
                  </span>
                </button>
              ))}
            </div>
            <input ref={searchRef} className="cx-input" style={{ maxWidth: 240 }} placeholder="Find an item  ( / )" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find an item" />
          </div>
          <div className="cx-items">
            {items.map((p) => {
              const n = inBag.get(p.id) || 0;
              const left = stock[p.id];
              return (
                <button type="button" key={p.id} className="cx-item" disabled={soldOut.has(p.id)} onClick={() => choose(p)}>
                  {n > 0 && <span className="cx-item-n">{n}</span>}
                  <b>{p.name}</b>
                  <span className="cx-small cx-muted cx-num">{soldOut.has(p.id) ? 'Sold out' : rs(p.price)}</span>
                  {!soldOut.has(p.id) && left !== undefined && left <= 5 && <span className="cx-small cx-late-text">Only {left} left</span>}
                </button>
              );
            })}
            {!items.length && <p className="cx-empty">Nothing matches “{q}”.</p>}
          </div>
        </div>

        <aside className="cx-card cx-cart" aria-label="This order">
          <div className="cx-seg" role="group" aria-label="Order type">
            <button type="button" aria-pressed={mode === 'pickup'} onClick={() => setMode('pickup')}>
              Counter
            </button>
            <button type="button" aria-pressed={mode === 'dinein'} onClick={() => setMode('dinein')}>
              Table
            </button>
            <button type="button" aria-pressed={mode === 'delivery'} onClick={() => setMode('delivery')}>
              Delivery
            </button>
          </div>
          <div className="cx-row">
            {mode !== 'delivery' && shops.length > 1 && (
              <select className="cx-select" value={loc} onChange={(e) => setLoc(+e.target.value)} aria-label="Shop">
                {shops.map((i) => (
                  <option key={i} value={i}>
                    {LOC_TITLES[i]}
                  </option>
                ))}
              </select>
            )}
            {mode === 'dinein' && (
              <select className="cx-select" value={table} onChange={(e) => setTable(+e.target.value)} aria-label="Table">
                {Array.from({ length: tables }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Table {i + 1}
                  </option>
                ))}
              </select>
            )}
            {mode === 'delivery' && (
              <select className="cx-select" value={area} onChange={(e) => setArea(+e.target.value)} aria-label="Area">
                {DELIVERY.areas.map((a, i) => (
                  <option key={i} value={i} disabled={!shops.includes(a[1])}>
                    {a[0]} · {rs(a[2])}
                  </option>
                ))}
              </select>
            )}
          </div>

          {lines.length ? (
            <div className="cx-stack" style={{ gap: 10 }}>
              {lines.map((l) => (
                <div key={l.key} className="cx-stack" style={{ gap: 6 }}>
                  <div className="cx-row between" style={{ flexWrap: 'nowrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{l.p.name}</p>
                      {l.p.options.length > 0 && <p className="cx-small cx-muted">{selLabel(l.p, l.sel)}</p>}
                      {l.note && noteOpen !== l.key && <p className="cx-small" style={{ color: 'var(--cx-accent)' }}>“{l.note}”</p>}
                    </div>
                    <div className="cx-row" style={{ flexWrap: 'nowrap' }}>
                      <span className="cx-qty">
                        <button type="button" aria-label="One less" onClick={() => setLines((ls) => ls.flatMap((x) => (x.key !== l.key ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : [])))}>
                          −
                        </button>
                        <span>{l.qty}</span>
                        <button type="button" aria-label="One more" onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)))}>
                          +
                        </button>
                      </span>
                      <span className="cx-mono cx-small" style={{ minWidth: 64, textAlign: 'right' }}>
                        {rs(unitPrice(l.p, l.sel) * l.qty)}
                      </span>
                    </div>
                  </div>
                  <div className="cx-row" style={{ gap: 6 }}>
                    <button type="button" className="cx-btn sm ghost" onClick={() => setNoteOpen(noteOpen === l.key ? null : l.key)}>
                      {l.note ? 'Edit request' : '+ Request'}
                    </button>
                    <button type="button" className="cx-btn sm ghost" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.p.name}`}>
                      Remove
                    </button>
                  </div>
                  {noteOpen === l.key && (
                    <div className="cx-stack" style={{ gap: 6 }}>
                      <input className="cx-input" autoFocus value={l.note} onChange={(e) => setNote(l.key, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setNoteOpen(null)} placeholder="Extra hot, no onions…" maxLength={120} aria-label={`Request for ${l.p.name}`} />
                      <div className="cx-row" style={{ gap: 4 }}>
                        {NOTE_CHIPS.map((c) => (
                          <button type="button" key={c} className="cx-btn sm" onClick={() => setNote(l.key, l.note ? (l.note.endsWith(' ') ? l.note + c : `${l.note}, ${c}`) : c)}>
                            {c.trim()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="cx-btn sm ghost" onClick={() => (lines.length < 2 || window.confirm('Clear this whole order?')) && clearAll()}>
                Clear order
              </button>
            </div>
          ) : (
            <p className="cx-small cx-muted">Tap items to add them. Press <kbd className="cx-kbd">/</kbd> to search.</p>
          )}

          <div className="cx-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label className="cx-field">
              <span>Name{mode === 'delivery' ? '' : ' · optional'}</span>
              <input value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} maxLength={40} />
            </label>
            <label className="cx-field">
              <span>Mobile{mode === 'delivery' ? '' : ' · optional'}</span>
              <input value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} maxLength={16} inputMode="tel" />
            </label>
          </div>
          {mode === 'delivery' && (
            <label className="cx-field">
              <span>Address</span>
              <textarea value={who.address} onChange={(e) => setWho({ ...who, address: e.target.value })} maxLength={160} placeholder="House, street, block, landmark" />
            </label>
          )}
          <label className="cx-field">
            <span>Note for the kitchen · optional</span>
            <input value={who.note} onChange={(e) => setWho({ ...who, note: e.target.value })} maxLength={140} placeholder="For the whole order" />
          </label>
          <div className="cx-row" style={{ flexWrap: 'nowrap' }}>
            <input className="cx-input" style={{ textTransform: 'uppercase' }} placeholder="Promo code" value={promoInput} onChange={(e) => setPromoInput(e.target.value.replace(/[^a-z0-9]/gi, ''))} onKeyDown={(e) => e.key === 'Enter' && applyPromo()} maxLength={24} aria-label="Promo code" disabled={!!promo} />
            {promo ? (
              <button type="button" className="cx-btn sm" onClick={() => (setPromo(null), setPromoInput(''))}>
                Remove {promo.code}
              </button>
            ) : (
              <button type="button" className="cx-btn sm" onClick={applyPromo} disabled={!promoInput.trim()}>
                Apply
              </button>
            )}
          </div>

          <div className="cx-sums cx-num">
            <div>
              <span className="cx-muted">Subtotal · {count} item{count === 1 ? '' : 's'}</span>
              <span>{rs(bill.sub)}</span>
            </div>
            {bill.discount > 0 && (
              <div>
                <span className="cx-muted">Discount {promo?.code}</span>
                <span>−{rs(bill.discount)}</span>
              </div>
            )}
            {bill.fee > 0 && (
              <div>
                <span className="cx-muted">Delivery</span>
                <span>{rs(bill.fee)}</span>
              </div>
            )}
            <div>
              <span className="cx-muted">Sales tax {Math.round(bill.rate * 100)}% · cash</span>
              <span>{rs(bill.tax)}</span>
            </div>
            <div className="total">
              <span>Total</span>
              <span>{rs(bill.total)}</span>
            </div>
          </div>
          {bill.total > cardBill.total && <p className="cx-small cx-muted">Paid by card or wallet the tax is 5%: {rs(cardBill.total)}, {rs(bill.total - cardBill.total)} less.</p>}

          {counter ? (
            <button type="button" className="cx-btn primary big block" disabled={!canCharge} onClick={() => setPaying(true)}>
              Charge {rs(bill.total)} <kbd className="cx-kbd">F2</kbd>
            </button>
          ) : (
            <>
              <button type="button" className="cx-btn primary big block" disabled={!canSend} onClick={() => send()}>
                {sending ? 'Sending…' : `Send to the kitchen · ${rs(bill.total)}`}
              </button>
              {can('orders.pay') && (
                <button type="button" className="cx-btn block" disabled={!canCharge} onClick={() => setPaying(true)}>
                  Take payment now <kbd className="cx-kbd">F2</kbd>
                </button>
              )}
            </>
          )}
          {counter && !can('orders.pay') && <p className="cx-small cx-muted">Your role can’t take payment, so it can’t ring up counter orders.</p>}
          {mode === 'delivery' && !deliveryOk && <p className="cx-small cx-muted">A delivery needs a mobile number and the full address.</p>}
          {!counter && <p className="cx-small cx-muted">{mode === 'dinein' ? 'Table orders are paid at the end of the meal.' : 'The rider collects payment on delivery.'}</p>}
        </aside>
      </div>

      {pick && <ItemSheet pick={pick} setPick={setPick} onAdd={() => (add(pick.p, pick.sel, pick.qty), setPick(null))} />}
      {paying && <PaySheet billFor={billFor} payTo={data?.prepay?.payTo || ''} busy={sending} onClose={() => setPaying(false)} onConfirm={(p) => send(p)} />}
      {done && <DoneSheet order={done} onPrint={() => printBill(done)} onKitchen={() => printHtml(kitchenSlipHtml(done))} onClose={() => setDone(null)} />}
    </>
  );
}

function ItemSheet({ pick, setPick, onAdd }: { pick: { p: Product; sel: Sel; qty: number }; setPick: (p: { p: Product; sel: Sel; qty: number } | null) => void; onAdd: () => void }) {
  return (
    <div className="cx-modal-bg" onClick={(e) => e.target === e.currentTarget && setPick(null)}>
      <div className="cx-modal" role="dialog" aria-modal="true" aria-label={pick.p.name}>
        <div className="cx-row between">
          <h2 className="cx-h2" style={{ fontSize: 20 }}>
            {pick.p.name}
          </h2>
          <span className="cx-mono">{rs(unitPrice(pick.p, pick.sel) * pick.qty)}</span>
        </div>
        {pick.p.options.map((o) => (
          <div className="cx-opt" key={o.key}>
            <p className="cx-eyebrow">{o.label}</p>
            <div className="cx-opt-choices">
              {o.choices.map((c, i) => (
                <button type="button" key={i} aria-pressed={pick.sel[o.key] === i} onClick={() => setPick({ ...pick, sel: { ...pick.sel, [o.key]: i } })}>
                  {c[0]}
                  {c[1] ? ` ${c[1] > 0 ? '+' : '−'}${Math.abs(c[1])}` : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="cx-row between">
          <span className="cx-qty">
            <button type="button" aria-label="One less" onClick={() => setPick({ ...pick, qty: Math.max(1, pick.qty - 1) })}>
              −
            </button>
            <span>{pick.qty}</span>
            <button type="button" aria-label="One more" onClick={() => setPick({ ...pick, qty: pick.qty + 1 })}>
              +
            </button>
          </span>
          <button type="button" className="cx-btn primary" autoFocus onClick={onAdd}>
            Add to order
          </button>
        </div>
      </div>
    </div>
  );
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '⌫'];

/** Take the money: cash with a keypad and change, a card with its approval code, or a wallet with its transaction ID. */
function PaySheet({ billFor, payTo, busy, onClose, onConfirm }: { billFor: (pay: number) => { total: number; tax: number; rate: number }; payTo: string; busy: boolean; onClose: () => void; onConfirm: (p: Payment) => void }) {
  const [method, setMethod] = useState(0);
  const [typed, setTyped] = useState('');
  const [ref, setRef] = useState('');
  const totals = [billFor(0), billFor(1), billFor(2)];
  const total = totals[method].total;
  const tendered = typed === '' ? undefined : Number(typed);
  const payment: Payment = { method, ...(method === 0 ? { tendered } : { ref: ref.trim() }) };
  const problem = paymentProblem(payment, total);
  const change = method === 0 ? (tendered ?? total) - total : 0;
  const ok = !problem && !busy;

  const press = useCallback((k: string) => {
    setTyped((t) => (k === '⌫' ? t.slice(0, -1) : k === 'C' ? '' : (t + k).replace(/^0+(?=\d)/, '').slice(0, 7)));
  }, []);
  const confirmRef = useRef<() => void>(() => {});
  useEffect(() => {
    confirmRef.current = () => ok && onConfirm(payment);
  });

  // A real keyboard works too: digits and backspace for the cash, Enter to take the payment.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmRef.current();
      } else if (method === 0 && !isTyping(e.target)) {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace') press('⌫');
        else if (e.key === 'Delete') press('C');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [method, press]);

  return (
    <div className="cx-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cx-modal cx-pay" role="dialog" aria-modal="true" aria-label="Take payment">
        <div className="cx-row between">
          <h2 className="cx-h2" style={{ fontSize: 20 }}>Take payment</h2>
          <button type="button" className="cx-btn sm ghost" onClick={onClose}>
            Close <kbd className="cx-kbd">Esc</kbd>
          </button>
        </div>
        <div className="cx-pay-methods" role="tablist" aria-label="How they pay">
          {PAY_KINDS.map((k, i) => (
            <button type="button" role="tab" key={k} aria-selected={method === i} className="cx-pay-method" onClick={() => setMethod(i)}>
              <b>{PAY[i][0].replace(' / ', ' · ')}</b>
              <span className="cx-num">{rs(totals[i].total)}</span>
              <small>{Math.round(totals[i].rate * 100)}% tax</small>
            </button>
          ))}
        </div>

        <div className="cx-pay-total">
          <span className="cx-muted">Customer pays</span>
          <b className="cx-num">{rs(total)}</b>
        </div>

        {method === 0 && (
          <div className="cx-pay-cash">
            <div className="cx-stack" style={{ gap: 10 }}>
              <div className="cx-row" style={{ gap: 6 }}>
                {cashChoices(total).map((v) => (
                  <button type="button" key={v} className="cx-btn sm" onClick={() => setTyped(String(v))}>
                    {v === total ? 'Exact' : rs(v)}
                  </button>
                ))}
              </div>
              <div className="cx-pay-tender">
                <span className="cx-muted">Cash received</span>
                <b className="cx-num">{typed === '' ? '—' : rs(Number(typed))}</b>
              </div>
              <div className={`cx-pay-change${typed !== '' && change < 0 ? ' short' : ''}`} aria-live="polite">
                {typed === '' ? (
                  <span className="cx-muted">Type what they hand over. Leave empty for exact change.</span>
                ) : change < 0 ? (
                  <>
                    <span>Still to pay</span>
                    <b className="cx-num">{rs(-change)}</b>
                  </>
                ) : (
                  <>
                    <span>Change to give back</span>
                    <b className="cx-num">{rs(change)}</b>
                  </>
                )}
              </div>
            </div>
            <div className="cx-keypad">
              {KEYS.map((k) => (
                <button type="button" key={k} onClick={() => press(k)} aria-label={k === '⌫' ? 'Delete' : k}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {method === 1 && (
          <div className="cx-stack" style={{ gap: 10 }}>
            <p className="cx-small cx-muted">Run {rs(total)} on the card machine first. When it approves, type the approval code printed on its slip.</p>
            <label className="cx-field">
              <span>Approval code</span>
              <input value={ref} onChange={(e) => setRef(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} maxLength={12} autoFocus autoComplete="off" inputMode="text" placeholder="e.g. 482915" />
            </label>
            {totals[0].total > total && <p className="cx-small cx-muted">Card tax is 5%: they pay {rs(totals[0].total - total)} less than cash.</p>}
          </div>
        )}

        {method === 2 && (
          <div className="cx-stack" style={{ gap: 10 }}>
            <p className="cx-small cx-muted">{payTo ? <>They send {rs(total)} to: <b>{payTo}</b></> : <>They send {rs(total)} by JazzCash, Easypaisa or Raast.</>} Check the money arrived, then type the transaction ID.</p>
            <label className="cx-field">
              <span>Transaction ID</span>
              <input value={ref} onChange={(e) => setRef(e.target.value.replace(/[^a-z0-9-]/gi, '').toUpperCase())} maxLength={30} autoFocus autoComplete="off" placeholder="From the wallet receipt" />
            </label>
          </div>
        )}

        {problem && (method > 0 ? ref.length > 0 : typed !== '') && <p className="cx-small" style={{ color: 'var(--cx-late)' }}>{problem}</p>}
        <button type="button" className="cx-btn go big block" disabled={!ok} onClick={() => onConfirm(payment)}>
          {busy ? 'Taking payment…' : `Take ${rs(total)} and send to the kitchen`} <kbd className="cx-kbd">Enter</kbd>
        </button>
      </div>
    </div>
  );
}

/** The order is paid and with the kitchen: the number to call out, the change to hand back, and the paper. */
function DoneSheet({ order, onPrint, onKitchen, onClose }: { order: StaffOrder; onPrint: () => void; onKitchen: () => void; onClose: () => void }) {
  const paid = order.paid;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const stations = Object.keys(order.stations);
  return (
    <div className="cx-modal-bg">
      <div className="cx-modal cx-done" role="dialog" aria-modal="true" aria-label="Order sent">
        <p className="cx-done-tick" aria-hidden="true">✓</p>
        <p className="cx-eyebrow">{paid ? 'Paid and sent to the kitchen' : 'Sent to the kitchen'}</p>
        <p className="cx-done-no">{orderNo(order.number)}</p>
        <p className="cx-muted">
          {order.mode === 'dinein' ? `Table ${order.table}` : order.mode === 'delivery' ? 'Delivery' : order.name && order.name !== 'Walk-in' ? order.name : 'Counter'} · {rs(order.totals.total)}
          {paid ? ` · ${PAY[paid.method][0]}` : ' · pay later'}
        </p>
        {stations.length > 0 && (
          <p className="cx-row" style={{ justifyContent: 'center', gap: 6 }}>
            {stations.map((s) => (
              <span key={s} className="cx-pill plain">
                {s === 'bar' ? 'Bar' : 'Kitchen'}
              </span>
            ))}
          </p>
        )}
        {paid?.change !== undefined && paid.change > 0 && (
          <div className="cx-pay-change" style={{ justifySelf: 'stretch' }}>
            <span>Give back</span>
            <b className="cx-num">{rs(paid.change)}</b>
          </div>
        )}
        <div className="cx-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="cx-btn" onClick={onPrint}>
            Print bill
          </button>
          <button type="button" className="cx-btn" onClick={onKitchen}>
            Kitchen slip
          </button>
        </div>
        <button type="button" ref={closeRef} className="cx-btn primary big block" onClick={onClose}>
          Next customer <kbd className="cx-kbd">Enter</kbd>
        </button>
      </div>
    </div>
  );
}

/** End of shift: count the drawer, see the difference, and close. The owner sees every close, and a drawer well short is emailed to them at once. */
function CloseTill({ till, onClosed }: { till: Till; onClosed: () => void }) {
  const run = useRun();
  const toast = useToast();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const n = counted === '' ? null : Number(counted);
  const diff = n === null ? null : n - till.drawer;
  const close = async () => {
    if (n === null || diff === null) return;
    if (!window.confirm(`Close the till? You counted ${rs(n)}; it should hold ${rs(till.drawer)}${diff ? ` (${varianceLabel(diff).toLowerCase()})` : ''}. The next shift starts from zero.`)) return;
    setBusy(true);
    const r = await run(() => api<{ close: TillClose }>('/api/staff/till', { counted: n, float: till.float, note }));
    setBusy(false);
    if (!r) return;
    toast(`Till closed: ${varianceLabel(r.close.variance)}.`, r.close.variance < 0 ? 'bad' : 'good');
    setCounted('');
    setNote('');
    onClosed();
  };
  return (
    <div className="cx-close-till">
      <p className="cx-eyebrow" style={{ marginBottom: 6 }}>Close my till</p>
      <div className="cx-till-grid" style={{ alignItems: 'end' }}>
        <label className="cx-field">
          <span>Cash you counted in the drawer</span>
          <input type="number" min={0} inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder={`Should be ${till.drawer}`} />
        </label>
        <div aria-live="polite">
          {diff === null ? (
            <p className="cx-small cx-muted">Count the notes and coins, type the total, and the difference shows here.</p>
          ) : (
            <p className="cx-num" style={{ fontSize: 20, fontWeight: 700, color: diff < 0 ? 'var(--cx-late)' : diff > 0 ? 'var(--cx-accent)' : 'var(--cx-ready)' }}>
              {varianceLabel(diff)}
              {diff <= -SHORT_ALERT && <span className="cx-small cx-muted" style={{ fontWeight: 400 }}> · the owner will be told</span>}
            </p>
          )}
        </div>
        <button type="button" className="cx-btn" disabled={n === null || busy} onClick={close}>
          {busy ? 'Closing…' : 'Close the till'}
        </button>
      </div>
      {diff !== null && diff !== 0 && (
        <label className="cx-field" style={{ marginTop: 8 }}>
          <span>What happened? · optional</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Gave change from my own pocket, a refund not entered…" />
        </label>
      )}
    </div>
  );
}

/** My shift so far: what I took, how it was paid, the cash that should be in the drawer, and my latest bills to print again. */
function TillCard({ biz, onPrintBill }: { biz: Business; onPrintBill: (o: StaffOrder, reprint?: boolean) => void }) {
  const { me } = useMe();
  const { data } = useLive();
  const run = useRun();
  const now = useNow(30000);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ day: string; till: Till; recentOrders: StaffOrder[] } | null>(null);
  const [float, setFloat] = useState(0);
  const [floatDay, setFloatDay] = useState('');
  const version = data?.v;

  const load = useCallback(
    (f: number) => run(() => api<{ day: string; till: Till; recentOrders: StaffOrder[] }>(`/api/staff/till?float=${f}`)).then((r) => r && setState(r)),
    [run],
  );
  useEffect(() => {
    // Refresh whenever the shop's orders change (a payment, a status moving on) and when the float is edited.
    load(float);
  }, [load, float, version]);
  useEffect(() => {
    Promise.resolve().then(() => {
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      setFloatDay(day);
      setFloat(Number(store.get(`brewns-float:${day}`)) || 0);
    });
  }, []);
  const saveFloat = (v: number) => {
    setFloat(v);
    if (floatDay) store.set(`brewns-float:${floatDay}`, String(v));
  };

  const t = state?.till;
  return (
    <section className="cx-card cx-till" style={{ marginBottom: 16 }} aria-label="My till">
      <div className="cx-row between">
        <div className="cx-row" style={{ gap: 18 }}>
          <div>
            <p className="cx-eyebrow">My till · {me.name.split(' ')[0]}</p>
            <p className="cx-num cx-till-big">{t ? rs(t.cash + t.card + t.wallet) : '—'}</p>
          </div>
          {t && (
            <p className="cx-small cx-muted">
              {t.orders} order{t.orders === 1 ? '' : 's'} · cash {rs(t.cash)} · card {rs(t.card)} · wallet {rs(t.wallet)}
            </p>
          )}
        </div>
        <button type="button" className="cx-btn sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Drawer and bills'}
        </button>
      </div>
      {open && t && (
        <div className="cx-stack" style={{ gap: 14, marginTop: 14 }}>
          <div className="cx-till-grid">
            <label className="cx-field">
              <span>Cash you started with</span>
              <input type="number" min={0} inputMode="numeric" value={float || ''} placeholder="0" onChange={(e) => saveFloat(Math.max(0, Math.floor(Number(e.target.value)) || 0))} />
            </label>
            <div>
              <p className="cx-eyebrow">Cash that should be in the drawer</p>
              <p className="cx-num cx-till-big">{rs(t.drawer)}</p>
              <p className="cx-small cx-muted">
                {rs(t.float)} start + {rs(t.cash)} cash sales{t.refundsCash ? ` − ${rs(t.refundsCash)} refunds` : ''}
              </p>
            </div>
            <button
              type="button"
              className="cx-btn"
              onClick={() => printHtml(tillSlipHtml(biz, { cashier: me.name, day: state!.day, orders: t.orders, cash: t.cash, card: t.card, wallet: t.wallet, refundsCash: t.refundsCash, float: t.float, drawer: t.drawer }))}
            >
              Print till report
            </button>
          </div>
          <CloseTill till={t} onClosed={() => (saveFloat(0), load(0))} />
          <div>
            <p className="cx-eyebrow" style={{ marginBottom: 6 }}>My latest bills</p>
            {!state!.recentOrders.length ? (
              <p className="cx-small cx-muted">Nothing yet today.</p>
            ) : (
              <ul className="cx-till-list">
                {state!.recentOrders.map((o) => (
                  <li key={o.number}>
                    <b className="cx-mono">{orderNo(o.number)}</b>
                    <span className="cx-muted cx-small">
                      {o.mode === 'dinein' ? `Table ${o.table}` : o.name} · {ago(o.placed, now)}
                    </span>
                    <span className="cx-num">{rs(o.totals.total)}</span>
                    <span className={`cx-pill ${o.status === 'ready' ? 'ready' : 'plain'}`}>{o.status === 'ready' ? 'Ready: call out' : STATUS_LABEL[o.status]}</span>
                    <button type="button" className="cx-btn sm" onClick={() => onPrintBill(o, true)}>
                      Print again
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

