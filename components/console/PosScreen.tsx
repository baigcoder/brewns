'use client';

import { useMemo, useState } from 'react';
import { CATALOG, defaultSel, DELIVERY, LOC_TITLES, PAY, selLabel, unitPrice, type Product, type Sel } from '@/lib/catalog';
import { orderNo, type Mode } from '@/lib/orderFlow';
import { priceOrder } from '@/lib/pricing';
import { api, rs } from './api';
import { useLive, type StaffOrder } from './Live';
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

type Line = { key: string; p: Product; sel: Sel; qty: number };

/** Ring up an order at the counter, for a table, or a delivery taken by phone. It goes straight to the kitchen screen. */
export function PosScreen({ startLoc, startTable }: { startLoc?: number; startTable?: number }) {
  const { me, can } = useMe();
  const { data, refresh } = useLive();
  const run = useRun();
  const toast = useToast();
  const shops = me.shops.length ? me.shops : LOC_TITLES.map((_, i) => i);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState<{ p: Product; sel: Sel; qty: number } | null>(null);
  const [mode, setMode] = useState<Mode>(startTable || me.role === 'waiter' ? 'dinein' : 'pickup');
  const [loc, setLoc] = useState(startLoc !== undefined && shops.includes(startLoc) ? startLoc : shops[0]);
  const [table, setTable] = useState(startTable || 1);
  const [area, setArea] = useState(0);
  const [who, setWho] = useState({ name: '', phone: '', address: '', note: '' });
  const [pay, setPay] = useState(0);
  const [sending, setSending] = useState(false);

  const soldOut = new Set(data?.soldOut || []);
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATALOG.filter((p) => (cat === 'all' || p.cat === cat) && (!s || p.name.toLowerCase().includes(s)));
  }, [cat, q]);
  const tables = data?.shops[loc]?.tables || 0;
  const bill = priceOrder(
    lines.map((l) => ({ cat: l.p.cat, qty: l.qty, unit: unitPrice(l.p, l.sel) })),
    { mode, area: mode === 'delivery' ? area : null, pay, promoPct: 0, useReward: false },
  );

  const add = (p: Product, sel: Sel, qty: number) => {
    const key = `${p.id}|${JSON.stringify(sel)}`;
    setLines((ls) => (ls.some((l) => l.key === key) ? ls.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) : [...ls, { key, p, sel, qty }]));
  };
  const choose = (p: Product) => (p.options.length ? setPick({ p, sel: defaultSel(p), qty: 1 }) : add(p, {}, 1));

  const send = async () => {
    setSending(true);
    const r = await run(() =>
      api<{ order: StaffOrder }>('/api/staff/orders', {
        items: lines.map((l) => ({ id: l.p.id, qty: l.qty, sel: l.sel })),
        mode,
        loc,
        table: mode === 'dinein' ? table : null,
        area: mode === 'delivery' ? area : null,
        address: who.address,
        name: who.name,
        phone: who.phone,
        note: who.note,
        pay,
      }),
    );
    setSending(false);
    if (!r) return;
    setLines([]);
    setWho({ name: '', phone: '', address: '', note: '' });
    refresh();
    toast(`${orderNo(r.order.number)} is on the kitchen screen · ${rs(r.order.totals.total)}`, 'good');
  };

  const shopForDelivery = DELIVERY.areas[area][1];
  const deliveryOk = mode !== 'delivery' || (who.address.trim().length >= 10 && who.phone.trim().length >= 10 && shops.includes(shopForDelivery));

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {LOC_TITLES[mode === 'delivery' ? shopForDelivery : loc]}
          </p>
          <h1 className="cx-h1">New order</h1>
        </div>
      </div>
      <div className="cx-pos">
        <div className="cx-stack" style={{ gap: 14 }}>
          <div className="cx-row">
            <div className="cx-seg" role="group" aria-label="Category">
              {CATS.map(([k, label]) => (
                <button type="button" key={k} aria-pressed={cat === k} onClick={() => setCat(k)}>
                  {label}
                </button>
              ))}
            </div>
            <input className="cx-input" style={{ maxWidth: 220 }} placeholder="Find an item" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="cx-items">
            {items.map((p) => (
              <button type="button" key={p.id} className="cx-item" disabled={soldOut.has(p.id)} onClick={() => choose(p)}>
                <b>{p.name}</b>
                <span className="cx-small cx-muted cx-num">{soldOut.has(p.id) ? 'Sold out' : rs(p.price)}</span>
              </button>
            ))}
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
            <div className="cx-stack">
              {lines.map((l) => (
                <div key={l.key} className="cx-row between" style={{ flexWrap: 'nowrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{l.p.name}</p>
                    {l.p.options.length > 0 && <p className="cx-small cx-muted">{selLabel(l.p, l.sel)}</p>}
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
              ))}
            </div>
          ) : (
            <p className="cx-small cx-muted">Tap items to add them.</p>
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
            <input value={who.note} onChange={(e) => setWho({ ...who, note: e.target.value })} maxLength={140} placeholder="Extra hot, no onions…" />
          </label>
          <label className="cx-field">
            <span>Payment</span>
            <select value={pay} onChange={(e) => setPay(+e.target.value)}>
              {PAY.map((p, i) => (
                <option key={i} value={i}>
                  {p[0]} · {i ? '5%' : '16%'} tax
                </option>
              ))}
            </select>
          </label>
          <div className="cx-sums cx-num">
            <div>
              <span className="cx-muted">Subtotal</span>
              <span>{rs(bill.sub)}</span>
            </div>
            {bill.fee > 0 && (
              <div>
                <span className="cx-muted">Delivery</span>
                <span>{rs(bill.fee)}</span>
              </div>
            )}
            <div>
              <span className="cx-muted">Sales tax {Math.round(bill.rate * 100)}%</span>
              <span>{rs(bill.tax)}</span>
            </div>
            <div className="total">
              <span>Total</span>
              <span>{rs(bill.total)}</span>
            </div>
          </div>
          <button type="button" className="cx-btn primary big block" disabled={!lines.length || sending || !deliveryOk || (mode === 'dinein' && !tables) || !can('orders.create')} onClick={send}>
            {sending ? 'Sending…' : `Send to the kitchen · ${rs(bill.total)}`}
          </button>
          {mode === 'delivery' && !deliveryOk && <p className="cx-small cx-muted">A delivery needs a mobile number and the full address.</p>}
        </aside>
      </div>

      {pick && (
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
              <button
                type="button"
                className="cx-btn primary"
                onClick={() => {
                  add(pick.p, pick.sel, pick.qty);
                  setPick(null);
                }}
              >
                Add to order
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
