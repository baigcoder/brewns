'use client';

import { useEffect, useMemo, useState } from 'react';
import { LOC_TITLES, PAY } from '@/lib/catalog';
import { MODE_LABEL, orderNo, pkDay, STATUS_LABEL, type Mode } from '@/lib/orderFlow';
import { api, pkDate, pkTime, rs, useNow } from './api';
import { chime, useLive, type StaffOrder } from './Live';
import { isLate, itemsLine, ModeTag, OrderCard, OrderDrawer, StatusPill } from './OrderBits';
import { useMe } from './Shell';
import { useRun } from './Toasts';

const COLUMNS: { key: string; label: string; match: (o: StaffOrder) => boolean }[] = [
  { key: 'new', label: 'New', match: (o) => o.status === 'received' },
  { key: 'making', label: 'Making', match: (o) => o.status === 'accepted' || o.status === 'preparing' },
  { key: 'ready', label: 'Ready', match: (o) => o.status === 'ready' },
  { key: 'out', label: 'On the road · at tables', match: (o) => ['onway', 'arriving'].includes(o.status) || (o.mode === 'dinein' && o.status === 'served') },
];

export function ShopFilter({ value, onChange }: { value: number | 'all'; onChange: (v: number | 'all') => void }) {
  const { me } = useMe();
  const shops = me.shops.length ? me.shops : LOC_TITLES.map((_, i) => i);
  if (shops.length < 2) return null;
  return (
    <div className="cx-seg" role="group" aria-label="Shop">
      <button type="button" aria-pressed={value === 'all'} onClick={() => onChange('all')}>
        All shops
      </button>
      {shops.map((i) => (
        <button type="button" key={i} aria-pressed={value === i} onClick={() => onChange(i)}>
          {LOC_TITLES[i].split(',')[0]}
        </button>
      ))}
    </div>
  );
}

export function OrdersScreen() {
  const { data, error } = useLive();
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [shop, setShop] = useState<number | 'all'>('all');
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const [open, setOpen] = useState<{ n: number; o?: StaffOrder } | null>(null);
  const [sound, setSound] = useState(true);
  const now = useNow(15000);
  useEffect(() => {
    const on = () => sound && chime();
    window.addEventListener('brewns:new-orders', on);
    return () => window.removeEventListener('brewns:new-orders', on);
  }, [sound]);

  const orders = (data?.orders || []).filter((o) => (shop === 'all' || o.loc === shop) && (mode === 'all' || o.mode === mode));
  const late = orders.filter((o) => isLate(o, now)).length;

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {data ? `${orders.length} open · ${late} late` : 'Loading…'}
          </p>
          <h1 className="cx-h1">Orders</h1>
        </div>
        <div className="cx-row">
          <div className="cx-seg" role="group" aria-label="View">
            <button type="button" aria-pressed={tab === 'live'} onClick={() => setTab('live')}>
              Live board
            </button>
            <button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>
              History
            </button>
          </div>
          {tab === 'live' && (
            <button type="button" className="cx-btn sm ghost" onClick={() => setSound(!sound)} aria-pressed={sound}>
              {sound ? '🔔 Chime on' : '🔕 Chime off'}
            </button>
          )}
        </div>
      </div>
      <div className="cx-row" style={{ marginBottom: 16 }}>
        <ShopFilter value={shop} onChange={setShop} />
        <div className="cx-seg" role="group" aria-label="Order type">
          {(['all', 'pickup', 'delivery', 'dinein'] as const).map((m) => (
            <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'all' ? 'Everything' : MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="cx-banner">{error}</p>}

      {tab === 'live' ? (
        <div className="cx-board">
          {COLUMNS.map((c) => {
            const list = orders.filter(c.match);
            return (
              <section className="cx-col" key={c.key} aria-label={c.label}>
                <div className="cx-col-h">
                  <p className="cx-eyebrow">{c.label}</p>
                  <span className="cx-mono cx-small cx-muted">{list.length}</span>
                </div>
                {list.length ? list.map((o) => <OrderCard key={o.number} o={o} now={now} onOpen={() => setOpen({ n: o.number })} />) : <p className="cx-empty cx-small">Nothing here.</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <History shop={shop} mode={mode} onOpen={(o) => setOpen({ n: o.number, o })} />
      )}
      {open && <OrderDrawer number={open.n} fallback={open.o} onClose={() => setOpen(null)} />}
    </>
  );
}

function History({ shop, mode, onOpen }: { shop: number | 'all'; mode: Mode | 'all'; onOpen: (o: StaffOrder) => void }) {
  const run = useRun();
  const today = pkDay(useNow(60000));
  const [day, setDay] = useState(today);
  const [days, setDays] = useState(1);
  const [q, setQ] = useState('');
  // What was loaded, and for which days, so a new choice shows "loading" until it arrives.
  const [loaded, setLoaded] = useState<{ key: string; orders: StaffOrder[] } | null>(null);
  const want = `${day}|${days}`;
  useEffect(() => {
    run(() => api<{ orders: StaffOrder[] }>(`/api/staff/orders?day=${day}&days=${days}`)).then((r) => setLoaded({ key: `${day}|${days}`, orders: r?.orders || [] }));
  }, [day, days, run]);
  const orders = loaded?.key === want ? loaded.orders : null;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (orders || []).filter(
      (o) => (shop === 'all' || o.loc === shop) && (mode === 'all' || o.mode === mode) && (!s || `${o.number} ${o.name} ${o.phone} ${itemsLine(o)}`.toLowerCase().includes(s)),
    );
  }, [orders, q, shop, mode]);
  const sold = list.filter((o) => o.status !== 'cancelled');

  const csv = () => {
    const rows = [
      ['Order', 'Date', 'Time', 'Shop', 'Type', 'Table', 'Customer', 'Mobile', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Tax', 'Total', 'Payment', 'Paid', 'Status'],
      ...list.map((o) => [
        o.number,
        o.day,
        pkTime(o.placed),
        LOC_TITLES[o.loc],
        MODE_LABEL[o.mode],
        o.table ?? '',
        o.name,
        o.phone,
        o.items.map((i) => `${i.qty} x ${i.name}${i.opts ? ` (${i.opts})` : ''}`).join('; '),
        o.totals.sub,
        o.totals.discount,
        o.totals.fee,
        o.totals.tax,
        o.totals.total,
        PAY[o.paid?.method ?? o.pay][0],
        o.paid ? 'yes' : 'no',
        STATUS_LABEL[o.status],
      ]),
    ];
    const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = `brewns-orders-${day}${days > 1 ? `-${days}d` : ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="cx-stack" style={{ gap: 14 }}>
      <div className="cx-row">
        <label className="cx-row cx-small">
          <span className="cx-muted">Up to</span>
          <input type="date" className="cx-select" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        <select className="cx-select" value={days} onChange={(e) => setDays(+e.target.value)} aria-label="How many days">
          <option value={1}>That day</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
        <input className="cx-input" style={{ maxWidth: 280 }} placeholder="Search number, name, mobile, item" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="cx-btn sm" onClick={csv} disabled={!list.length}>
          Download CSV
        </button>
        <span className="cx-small cx-muted cx-num">
          {sold.length} orders · {rs(sold.reduce((s, o) => s + o.totals.total, 0))}
        </span>
      </div>
      {orders === null ? (
        <p className="cx-empty">Loading…</p>
      ) : !list.length ? (
        <p className="cx-empty">
          <b>No orders</b>Try another day or clear the search.
        </p>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>When</th>
                <th>Shop</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="r">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.number} className="click" onClick={() => onOpen(o)}>
                  <td className="cx-mono">{orderNo(o.number)}</td>
                  <td className="cx-mono cx-small cx-muted">
                    {days > 1 ? `${pkDate(o.placed)} ` : ''}
                    {pkTime(o.placed)}
                  </td>
                  <td>{LOC_TITLES[o.loc].split(',')[0]}</td>
                  <td>
                    <ModeTag o={o} />
                  </td>
                  <td>{o.name}</td>
                  <td className="cx-muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemsLine(o)}
                  </td>
                  <td className="r cx-num">{rs(o.totals.total)}</td>
                  <td>
                    <StatusPill status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
