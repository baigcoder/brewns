'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { MODE_LABEL, orderNo, type Mode, type Status } from '@/lib/orderFlow';
import { api, pkDate, pkTime, rs, rsShort, useNow } from './api';
import { useLive } from './Live';
import { isLate, StatusPill } from './OrderBits';
import { useMe } from './Shell';
import { useRun } from './Toasts';

type K = { gross: number; net: number; tax: number; fees: number; discount: number; orders: number; avg: number; items: number; cancelled: number; unpaid: number; customers: number; prepMin: number; onTimePct: number };
type Report = {
  range: string;
  days: string[];
  kpis: K;
  prev: K;
  byHour: { h: number; sales: number; orders: number }[];
  byDay: { day: string; sales: number; orders: number }[];
  byShop: (K & { loc: number })[];
  byMode: { mode: Mode; orders: number; sales: number }[];
  byPay: { pay: number; label: string; orders: number; sales: number }[];
  top: { id: string; name: string; cat: string; qty: number; sales: number }[];
  promos: { code: string; uses: number; discount: number }[];
  team: { name: string; taken: number; rides: number; sales: number }[];
  source: { source: string; orders: number }[];
  repeatCustomers: number;
  recent: { number: number; placed: number; name: string; total: number; mode: Mode; status: Status; loc: number; table: number | null }[];
  demo: boolean;
};

const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7d', '7 days'],
  ['30d', '30 days'],
] as const;
const COMPARE: Record<string, string> = { today: 'vs same day last week, same time', yesterday: 'vs the day before', '7d': 'vs the 7 days before', '30d': 'vs the 30 days before' };

function Delta({ now, before, invert, unit = '%' }: { now: number; before: number; invert?: boolean; unit?: string }) {
  if (!before && !now) return <span className="cx-kpi-d">—</span>;
  if (!before) return <span className="cx-kpi-d up">New</span>;
  const pct = unit === 'pt' ? now - before : ((now - before) / before) * 100;
  const good = invert ? pct < 0 : pct > 0;
  if (Math.abs(pct) < 0.5) return <span className="cx-kpi-d">Level</span>;
  return (
    <span className={`cx-kpi-d ${good ? 'up' : 'down'}`}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(unit === 'pt' ? 0 : pct > 99 ? 0 : 1)}
      {unit === 'pt' ? ' pts' : '%'}
    </span>
  );
}

function Bars({ data, label }: { data: { key: string; axis: string; value: number; tip: string }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const every = Math.ceil(data.length / 12);
  return (
    <figure>
      <div className="cx-bars" role="img" aria-label={label}>
        {data.map((d) => (
          <div key={d.key} className={`cx-bar${d.value ? '' : ' zero'}`} tabIndex={0} aria-label={d.tip}>
            <i style={{ height: `${(d.value / max) * 100}%` }} />
            <span className="tip">{d.tip}</span>
          </div>
        ))}
      </div>
      <div className="cx-axis" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key}>{i % every === 0 ? d.axis : ''}</span>
        ))}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary className="cx-small cx-muted" style={{ cursor: 'pointer' }}>
          Show as a table
        </summary>
        <table className="cx-table" style={{ marginTop: 8 }}>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td>{d.axis}</td>
                <td className="r">{d.tip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function OverviewScreen() {
  const { me } = useMe();
  const { data: live } = useLive();
  const run = useRun();
  const [range, setRange] = useState<string>('today');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => run(() => api<Report>(`/api/staff/reports?range=${range}`)).then((x) => x && setReport(x)), [range, run]);
  useEffect(() => {
    load();
  }, [load]);
  const r = report?.range === range ? report : null;
  // Today's numbers move with the day: refresh when the live board changes, at most every 20 s.
  const [lastV, setLastV] = useState(0);
  useEffect(() => {
    if (range !== 'today' || !live || live.v === lastV) return;
    const t = setTimeout(() => {
      setLastV(live.v);
      load();
    }, 20000);
    return () => clearTimeout(t);
  }, [live, lastV, range, load]);

  const demo = async (action: 'seed' | 'clear') => {
    setBusy(true);
    await run(() => api('/api/staff/demo', { action }), action === 'seed' ? 'Sample data loaded: 30 days of orders.' : 'Sample data cleared.');
    setBusy(false);
    load();
  };

  const now = useNow(30000);
  const hour = Number(pkTime(now).slice(0, 2));
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const open = live?.orders.filter((o) => !['served'].includes(o.status)) || [];
  const k = r?.kpis;
  const p = r?.prev;

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {hello}, {me.name.split(' ')[0]}
          </p>
          <h1 className="cx-h1">Overview</h1>
        </div>
        <div className="cx-seg" role="group" aria-label="Period">
          {RANGES.map(([key, label]) => (
            <button type="button" key={key} aria-pressed={range === key} onClick={() => setRange(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right now, from the live board. */}
      <section className="cx-card cx-row between" style={{ marginBottom: 14 }}>
        <div className="cx-row" style={{ gap: 22 }}>
          <span className="cx-eyebrow">
            <b>●</b> Right now
          </span>
          {[
            ['New', open.filter((o) => o.status === 'received').length, '/dashboard/orders'],
            ['Being made', open.filter((o) => ['accepted', 'preparing'].includes(o.status)).length, '/dashboard/kitchen'],
            ['Ready', open.filter((o) => o.status === 'ready').length, '/dashboard/orders'],
            ['On the road', open.filter((o) => ['onway', 'arriving'].includes(o.status)).length, '/dashboard/deliveries'],
            ['Late', open.filter((o) => isLate(o, now)).length, '/dashboard/orders'],
            ['Table calls', live?.calls.length || 0, '/dashboard/floor'],
          ].map(([label, n, href]) => (
            <Link key={label as string} href={href as string} className="cx-row" style={{ gap: 6 }}>
              <b className="cx-num" style={{ fontFamily: 'var(--font-geist)', fontSize: 20, color: label === 'Late' && n ? 'var(--cx-late)' : undefined }}>
                {n}
              </b>
              <span className="cx-small cx-muted">{label}</span>
            </Link>
          ))}
        </div>
        {live?.shops.some((s) => s.paused) && (
          <Link href="/dashboard/shops" className="cx-pill cancelled">
            {live.shops.filter((s) => s.paused).length} shop paused
          </Link>
        )}
      </section>

      {r && !k?.orders && !r.demo && me.role === 'owner' && (
        <section className="cx-card cx-row between" style={{ marginBottom: 14, borderColor: 'rgb(213 140 61 / 0.5)' }}>
          <div className="cx-stack" style={{ gap: 4, maxWidth: 620 }}>
            <p className="cx-h2">No orders {range === 'today' ? 'yet today' : 'in this period'}.</p>
            <p className="cx-small cx-muted">Want to see the dashboard working first? Load 30 days of sample orders across the three shops. They’re marked as samples and clear in one click.</p>
          </div>
          <button type="button" className="cx-btn primary" disabled={busy} onClick={() => demo('seed')}>
            {busy ? 'Loading…' : 'Load sample data'}
          </button>
        </section>
      )}
      {r?.demo && me.role === 'owner' && (
        <p className="cx-banner cx-row between">
          <span>You’re looking at sample orders (numbers from 900001). Clear them before you open for real.</span>
          <button type="button" className="cx-btn sm" disabled={busy} onClick={() => window.confirm('Remove every sample order?') && demo('clear')}>
            Clear sample data
          </button>
        </p>
      )}

      {!r || !k || !p ? (
        <p className="cx-empty">Adding it up…</p>
      ) : (
        <div className="cx-stack" style={{ gap: 14 }}>
          <div className="cx-kpis">
            <div className="cx-kpi">
              <span className="cx-eyebrow">Sales</span>
              <span className="cx-kpi-v">{rsShort(k.gross)}</span>
              <Delta now={k.gross} before={p.gross} />
            </div>
            <div className="cx-kpi">
              <span className="cx-eyebrow">Orders</span>
              <span className="cx-kpi-v">{k.orders}</span>
              <Delta now={k.orders} before={p.orders} />
            </div>
            <div className="cx-kpi">
              <span className="cx-eyebrow">Average bill</span>
              <span className="cx-kpi-v">{rs(k.avg)}</span>
              <Delta now={k.avg} before={p.avg} />
            </div>
            <div className="cx-kpi">
              <span className="cx-eyebrow">Customers</span>
              <span className="cx-kpi-v">{k.customers}</span>
              <Delta now={k.customers} before={p.customers} />
            </div>
            <div className="cx-kpi">
              <span className="cx-eyebrow">Ready in</span>
              <span className="cx-kpi-v">{k.prepMin ? `${k.prepMin.toFixed(1)} min` : '—'}</span>
              <Delta now={k.prepMin} before={p.prepMin} invert />
            </div>
            <div className="cx-kpi">
              <span className="cx-eyebrow">On time</span>
              <span className="cx-kpi-v">{k.orders ? `${Math.round(k.onTimePct)}%` : '—'}</span>
              <Delta now={k.onTimePct} before={p.onTimePct} unit="pt" />
            </div>
          </div>
          <p className="cx-small cx-faint" style={{ marginTop: -6 }}>
            Changes are {COMPARE[r.range]}. Sales include tax and delivery; net of both: {rs(k.net)}. {k.cancelled ? `${k.cancelled} cancelled.` : ''} {k.unpaid ? `${rs(k.unpaid)} not yet marked paid.` : ''}
          </p>

          <div className="cx-grid two">
            <section className="cx-card">
              <div className="cx-card-h">
                <p className="cx-h2">{r.days.length > 1 ? 'Sales by day' : 'Sales by hour'}</p>
                <span className="cx-small cx-muted">{rs(k.gross)}</span>
              </div>
              {r.days.length > 1 ? (
                <Bars label="Sales by day" data={r.byDay.map((d) => ({ key: d.day, axis: pkDate(Date.parse(`${d.day}T07:00:00Z`)).split(' ')[0], value: d.sales, tip: `${pkDate(Date.parse(`${d.day}T07:00:00Z`))}: ${rs(d.sales)} · ${d.orders} orders` }))} />
              ) : (
                <Bars label="Sales by hour" data={r.byHour.slice(7, 21).map((h) => ({ key: String(h.h), axis: String(h.h).padStart(2, '0'), value: h.sales, tip: `${String(h.h).padStart(2, '0')}:00–${String(h.h + 1).padStart(2, '0')}:00: ${rs(h.sales)} · ${h.orders} orders` }))} />
              )}
            </section>

            <section className="cx-card">
              <div className="cx-card-h">
                <p className="cx-h2">How people order</p>
                <span className="cx-small cx-muted">{k.orders} orders</span>
              </div>
              <div className="cx-stackbar" role="img" aria-label={r.byMode.map((m) => `${MODE_LABEL[m.mode]} ${m.orders}`).join(', ')}>
                {r.byMode.map((m) => (m.orders ? <i key={m.mode} style={{ flex: m.orders, background: `var(--cx-${m.mode})` }} /> : null))}
              </div>
              <div className="cx-legend">
                {r.byMode.map((m) => (
                  <span key={m.mode}>
                    <i style={{ background: `var(--cx-${m.mode})` }} />
                    {MODE_LABEL[m.mode]} · <b>{k.orders ? Math.round((m.orders / k.orders) * 100) : 0}%</b> <span className="cx-muted">{rsShort(m.sales)}</span>
                  </span>
                ))}
              </div>
              <div className="cx-divider" style={{ margin: '16px 0' }} />
              <p className="cx-eyebrow" style={{ marginBottom: 10 }}>
                Paid by
              </p>
              <div className="cx-hbars">
                {r.byPay.map((x) => (
                  <div className="cx-hbar" key={x.pay}>
                    <span>{x.label.charAt(0) + x.label.slice(1).toLowerCase()}</span>
                    <span className="cx-mono cx-small">
                      {rs(x.sales)} · {x.orders}
                    </span>
                    <div className="cx-hbar-track">
                      <i style={{ width: `${k.gross ? (x.sales / k.gross) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="cx-small cx-muted" style={{ marginTop: 14 }}>
                {r.source.map((s) => `${s.orders} ${s.source === 'online' ? 'online' : s.source === 'counter' ? 'at the counter' : 'from tables'}`).join(' · ')} · {r.repeatCustomers} came back more than once
              </p>
            </section>
          </div>

          <section className="cx-card">
            <div className="cx-card-h">
              <p className="cx-h2">Shops</p>
            </div>
            <div className="cx-table-wrap" style={{ border: 0 }}>
              <table className="cx-table">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th className="r">Sales</th>
                    <th className="r">Orders</th>
                    <th className="r">Average</th>
                    <th className="r">Ready in</th>
                    <th className="r">On time</th>
                    <th className="r">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byShop.map((s) => (
                    <tr key={s.loc}>
                      <td>{LOC_TITLES[s.loc]}</td>
                      <td className="r cx-num">{rs(s.gross)}</td>
                      <td className="r cx-num">{s.orders}</td>
                      <td className="r cx-num">{rs(s.avg)}</td>
                      <td className="r cx-num">{s.prepMin ? `${s.prepMin.toFixed(1)} min` : '—'}</td>
                      <td className="r cx-num" style={{ color: s.orders && s.onTimePct < 80 ? 'var(--cx-late)' : undefined }}>
                        {s.orders ? `${Math.round(s.onTimePct)}%` : '—'}
                      </td>
                      <td className="r cx-num">{s.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="cx-grid two">
            <section className="cx-card">
              <div className="cx-card-h">
                <p className="cx-h2">What sells</p>
                <span className="cx-small cx-muted">by sales</span>
              </div>
              {r.top.length ? (
                <div className="cx-hbars">
                  {r.top.map((t) => (
                    <div className="cx-hbar" key={t.id}>
                      <span>{t.name.charAt(0) + t.name.slice(1).toLowerCase()}</span>
                      <span className="cx-mono cx-small">
                        {rs(t.sales)} · {t.qty} sold
                      </span>
                      <div className="cx-hbar-track">
                        <i style={{ width: `${(t.sales / r.top[0].sales) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cx-muted">Nothing sold yet.</p>
              )}
            </section>

            <section className="cx-card cx-stack" style={{ gap: 18, alignContent: 'start' }}>
              <div>
                <div className="cx-card-h">
                  <p className="cx-h2">Latest orders</p>
                  <Link href="/dashboard/orders" className="cx-link cx-small">
                    All orders
                  </Link>
                </div>
                {r.recent.length ? (
                  <div className="cx-stack" style={{ gap: 8 }}>
                    {r.recent.map((o) => (
                      <div key={o.number} className="cx-row between" style={{ flexWrap: 'nowrap' }}>
                        <span className="cx-row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                          <span className="cx-mono cx-small cx-muted">{pkTime(o.placed)}</span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {orderNo(o.number)} · {o.name}
                          </span>
                        </span>
                        <span className="cx-row" style={{ flexWrap: 'nowrap' }}>
                          <span className="cx-num cx-small">{rs(o.total)}</span>
                          <StatusPill status={o.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="cx-muted">None yet.</p>
                )}
              </div>
              {r.team.length > 0 && (
                <div>
                  <p className="cx-h2" style={{ marginBottom: 10 }}>
                    Team
                  </p>
                  <div className="cx-stack" style={{ gap: 6 }}>
                    {r.team.map((t) => (
                      <div key={t.name} className="cx-row between">
                        <span>{t.name}</span>
                        <span className="cx-small cx-muted">{[t.taken ? `${t.taken} orders rung up · ${rsShort(t.sales)}` : '', t.rides ? `${t.rides} deliveries` : ''].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {r.promos.length > 0 && (
                <div>
                  <p className="cx-h2" style={{ marginBottom: 10 }}>
                    Promo codes
                  </p>
                  {r.promos.map((x) => (
                    <div key={x.code} className="cx-row between">
                      <span className="cx-mono">{x.code}</span>
                      <span className="cx-small cx-muted">
                        {x.uses} uses · {rs(x.discount)} off
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
