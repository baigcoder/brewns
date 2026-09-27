'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LOC_TITLES, PAY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { ago, api, rs } from './api';
import { useLive, type StaffOrder } from './Live';
import { playWaiterBell } from '@/lib/audio-alerts';
import { itemsLine, StatusPill } from './OrderBits';
import { useMe } from './Shell';
import { useRun } from './Toasts';

/** The floor: every table at a glance, calls from tables, food ready to serve, bills to settle. */
export function FloorScreen() {
  const { data, act, refresh } = useLive();
  const { me, can, canAny } = useMe();
  const run = useRun();
  const shops = me.shops.length ? me.shops : LOC_TITLES.map((_, i) => i);
  const [loc, setLoc] = useState(shops[0]);
  const [table, setTable] = useState<number | null>(null);
  const [tab, setTab] = useState<'tables' | 'reservations'>('tables');
  const [reservations, setReservations] = useState<any[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const loadReservations = useCallback(() => {
    fetch(`/api/reservations?loc=${loc}`)
      .then((res) => res.json())
      .then((d) => {
        if (d?.reservations) setReservations(d.reservations);
      })
      .catch(() => {});
  }, [loc]);

  useEffect(() => {
    if (tab === 'reservations') {
      loadReservations();
    }
  }, [tab, loadReservations]);

  const calls = (data?.calls || []).filter((c) => c.loc === loc);
  // A brass service bell chime when a new call comes in, not when one is answered.
  const callCount = data?.calls.length || 0;
  const lastCalls = useRef(callCount);
  useEffect(() => {
    if (callCount > lastCalls.current) playWaiterBell();
    lastCalls.current = callCount;
  }, [callCount]);

  const tables = data?.shops[loc]?.tables || 0;
  const atTables = (data?.orders || []).filter((o) => o.mode === 'dinein' && o.loc === loc && o.status !== 'cancelled');
  const ordersAt = (n: number) => atTables.filter((o) => o.table === n);
  const toServe = atTables.filter((o) => o.status === 'ready');
  const stateOf = (n: number) => {
    const list = ordersAt(n);
    if (calls.some((c) => c.table === n)) return 'call';
    if (list.some((o) => o.status === 'ready')) return 'serve';
    if (list.length && list.every((o) => o.status === 'served') && list.some((o) => !o.paid)) return 'bill';
    if (list.length) return 'busy';
    return 'free';
  };
  const LABEL = { call: 'Calling', serve: 'Food ready', bill: 'Eating · bill open', busy: 'Order in', free: 'Free' } as const;

  const answer = (id: string) => run(() => api('/api/staff/calls', { id }).then(refresh), 'On your way.');

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {LOC_TITLES[loc]} · {tab === 'tables' ? `${atTables.length} table order${atTables.length === 1 ? '' : 's'} open` : `${reservations.length} booking${reservations.length === 1 ? '' : 's'}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 className="cx-h1" style={{ margin: 0 }}>Floor</h1>
            <div className="cx-seg" role="tablist">
              <button type="button" aria-pressed={tab === 'tables'} onClick={() => setTab('tables')}>
                🍽️ Live Tables
              </button>
              <button type="button" aria-pressed={tab === 'reservations'} onClick={() => setTab('reservations')}>
                📅 Bookings ({reservations.filter((r) => r.status === 'confirmed').length})
              </button>
            </div>
          </div>
        </div>
        {shops.length > 1 && (
          <div className="cx-seg" role="group" aria-label="Shop">
            {shops.map((i) => (
              <button type="button" key={i} aria-pressed={loc === i} onClick={() => setLoc(i)}>
                {LOC_TITLES[i].split(',')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'reservations' ? (
        <section className="cx-card" style={{ marginBottom: 24 }}>
          <div className="cx-card-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="cx-h2">Table Bookings & Reservations</p>
              <span className="cx-small cx-muted">Today&apos;s guest reservations for {LOC_TITLES[loc]}</span>
            </div>
            <Link href="/reserve" target="_blank" className="cx-btn primary sm">
              + New Reservation
            </Link>
          </div>
          {reservations.length === 0 ? (
            <p className="cx-empty" style={{ padding: '32px 16px' }}>
              No reservations recorded yet for {LOC_TITLES[loc]}.
            </p>
          ) : (
            <div className="cx-stack">
              {reservations.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--cx-line-2, #262624)',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 16 }}>{r.name}</b>
                      <span className="cx-small cx-muted" style={{ fontFamily: 'var(--font-space-mono)' }}>{r.code}</span>
                      <span
                        className="cx-small"
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: r.status === 'seated' ? 'rgba(34, 197, 94, 0.15)' : r.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(201, 147, 85, 0.15)',
                          color: r.status === 'seated' ? '#4ade80' : r.status === 'cancelled' ? '#f87171' : 'var(--cx-accent, #c99355)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="cx-small cx-muted" style={{ display: 'flex', gap: 12 }}>
                      <span>🕒 {r.time} ({r.date})</span>
                      <span>👥 {r.guests} Guests</span>
                      <span>📍 Area: {r.area === 'indoor' ? '🛋️ Lounge' : r.area === 'terrace' ? '🌿 Terrace' : '☕ Bar'}</span>
                      <span>📞 {r.phone}</span>
                    </div>
                    {r.notes && (
                      <div className="cx-small" style={{ color: '#ccc', fontStyle: 'italic', marginTop: 2 }}>
                        “{r.notes}”
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {r.status === 'confirmed' && (
                      <>
                        <button
                          type="button"
                          className="cx-btn go sm"
                          onClick={() => {
                            fetch('/api/reservations', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: r.id, status: 'seated' }),
                            }).then(loadReservations);
                          }}
                        >
                          Seat Guests
                        </button>
                        <button
                          type="button"
                          className="cx-btn sm"
                          onClick={() => {
                            fetch('/api/reservations', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: r.id, status: 'cancelled' }),
                            }).then(loadReservations);
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {calls.length > 0 && (
        <div className="cx-callbar" style={{ marginBottom: 18 }}>
          {calls.map((c) => (
            <div className="cx-call" key={c.id}>
              <span>
                <b style={{ fontFamily: 'var(--font-geist)', fontSize: 18 }}>Table {c.table}</b> {c.kind === 'bill' ? 'wants the bill' : 'is calling a waiter'} <span className="cx-muted cx-small">· {ago(c.t, now)}</span>
              </span>
              <button type="button" className="cx-btn primary" onClick={() => answer(c.id)}>
                On my way
              </button>
            </div>
          ))}
        </div>
      )}

      {toServe.length > 0 && (
        <section className="cx-card" style={{ marginBottom: 18 }}>
          <div className="cx-card-h">
            <p className="cx-h2">Ready to serve</p>
            <span className="cx-small cx-muted">{toServe.length}</span>
          </div>
          <div className="cx-stack">
            {toServe.map((o) => (
              <div key={o.number} className="cx-row between">
                <span>
                  <b>Table {o.table}</b> <span className="cx-muted">· {itemsLine(o)}</span>
                </span>
                {canAny('floor.tables', 'orders.manage') && (
                  <button type="button" className="cx-btn go" onClick={() => run(() => act(o.number, { type: 'served' }))}>
                    Served
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!data ? (
        <p className="cx-empty">Loading the floor…</p>
      ) : !tables ? (
        <p className="cx-empty">
          <b>No tables set up for this shop.</b>The owner or a manager can add them on the Shops page.
        </p>
      ) : (
        <div className="cx-tables">
          {Array.from({ length: tables }, (_, i) => i + 1).map((n) => {
            const st = stateOf(n);
            const list = ordersAt(n);
            return (
              <button type="button" key={n} className={`cx-table-tile ${st === 'free' ? '' : st}`} onClick={() => setTable(n)}>
                <b>{n}</b>
                <span className="cx-small">{LABEL[st]}</span>
                {list.length > 0 && <span className="cx-small cx-muted cx-num">{rs(list.reduce((s, o) => s + o.totals.total, 0))}</span>}
              </button>
            );
          })}
        </div>
      )}

      {table !== null && <TableSheet loc={loc} table={table} orders={ordersAt(table)} onClose={() => setTable(null)} canCreate={can('orders.create')} canPay={can('orders.pay')} />}
    </>
  );
}

function TableSheet({ loc, table, orders, onClose, canCreate, canPay }: { loc: number; table: number; orders: StaffOrder[]; onClose: () => void; canCreate: boolean; canPay: boolean }) {
  const { act } = useLive();
  const run = useRun();
  const [method, setMethod] = useState(0);
  const unpaid = orders.filter((o) => !o.paid);
  const due = unpaid.reduce((s, o) => s + o.totals.total, 0);
  const settle = async () => {
    for (const o of unpaid) await run(() => act(o.number, { type: 'paid', method }));
    onClose();
  };
  return (
    <div className="cx-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cx-modal" role="dialog" aria-modal="true" aria-label={`Table ${table}`}>
        <div className="cx-row between">
          <h2 className="cx-h1" style={{ fontSize: 26 }}>
            Table {table}
          </h2>
          <button type="button" className="cx-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {orders.length ? (
          orders.map((o) => (
            <div key={o.number} className="cx-card cx-stack" style={{ gap: 6 }}>
              <div className="cx-row between">
                <b className="cx-mono">{orderNo(o.number)}</b>
                <StatusPill status={o.status} />
              </div>
              <p className="cx-muted cx-small">{itemsLine(o)}</p>
              <div className="cx-row between">
                <span className="cx-num">{rs(o.totals.total)}</span>
                <span className="cx-small">{o.paid ? `Paid · ${PAY[o.paid.method][0]}` : 'Unpaid'}</span>
              </div>
              {o.status === 'ready' && (
                <button type="button" className="cx-btn go" onClick={() => run(() => act(o.number, { type: 'served' }))}>
                  Served
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="cx-muted">Nothing ordered at this table right now.</p>
        )}
        {canPay && unpaid.length > 0 && (
          <div className="cx-card cx-stack">
            <p className="cx-h2">The bill · {rs(due)}</p>
            <p className="cx-small cx-muted">Sales tax is on each order: 16% cash, 5% card or wallet, as the customer chose. Taking a different method here only records how they paid.</p>
            <div className="cx-row">
              <select className="cx-select" value={method} onChange={(e) => setMethod(+e.target.value)} aria-label="Paid by">
                {PAY.map((p, i) => (
                  <option key={i} value={i}>
                    {p[0]}
                  </option>
                ))}
              </select>
              <button type="button" className="cx-btn primary" onClick={settle}>
                Settle {rs(due)}
              </button>
            </div>
          </div>
        )}
        {canCreate && (
          <Link className="cx-btn big" href={`/dashboard/new?loc=${loc}&table=${table}`}>
            + Add an order for table {table}
          </Link>
        )}
      </div>
    </div>
  );
}
