'use client';

import { useEffect, useMemo, useState } from 'react';
import { LOC_TITLES, SHOP_CODES } from '@/lib/catalog';
import { qrSvg } from '@/lib/qr';
import type { Business } from '@/lib/receipt';
import { api } from './api';
import { useLive } from './Live';
import { useMe } from './Shell';
import { useRun } from './Toasts';

/** Each shop's switches, and the QR codes that go on its tables. */
export function ShopsScreen() {
  const { data, refresh } = useLive();
  const { me } = useMe();
  const run = useRun();
  const shops = me.shops.length ? me.shops : LOC_TITLES.map((_, i) => i);
  const [online, setOnline] = useState<boolean | null>(null);
  const [qrShop, setQrShop] = useState<number | null>(null);
  useEffect(() => {
    if (me.role === 'owner') run(() => api<{ live: boolean }>('/api/public/status')).then((r) => r && setOnline(r.live));
  }, [me.role, run]);

  const save = (body: Record<string, unknown>, done?: string) => run(() => api('/api/staff/shops', body).then(refresh), done);

  return (
    <>
      <div className="cx-pagehead cx-noprint">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> Pause, wait times, tables
          </p>
          <h1 className="cx-h1">Shops</h1>
        </div>
      </div>

      {me.role === 'owner' && online !== null && (
        <section className="cx-card cx-row between cx-noprint" style={{ marginBottom: 16 }}>
          <div className="cx-stack" style={{ gap: 4 }}>
            <p className="cx-h2">Orders through the console</p>
            <p className="cx-small cx-muted">
              On: every order from the site lands here, and customers follow the kitchen’s real progress. Off: the site goes back to email-only orders with an estimated timeline.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            className="cx-switch"
            aria-checked={online}
            aria-label="Orders through the console"
            onClick={async () => {
              const r = await run(() => api('/api/staff/shops', { online: !online }), !online ? 'Orders now come to the console.' : 'The site is back to email-only orders.');
              if (r) setOnline(!online);
            }}
          />
        </section>
      )}

      {me.role === 'owner' && data?.digest !== undefined && (
        <section className="cx-card cx-row between cx-noprint" style={{ marginBottom: 16 }}>
          <div className="cx-stack" style={{ gap: 4 }}>
            <p className="cx-h2">Evening summary email</p>
            <p className="cx-small cx-muted">Each evening after closing, every owner gets the day in a few lines: sales against last week, best sellers, refunds still to send. Days with no orders send nothing.</p>
          </div>
          <button
            type="button"
            role="switch"
            className="cx-switch"
            aria-checked={data.digest}
            aria-label="Evening summary email"
            onClick={() => save({ digest: !data.digest }, data.digest ? 'No more evening emails.' : 'You will get a summary each evening.')}
          />
        </section>
      )}

      {data?.signedTables !== undefined && (
        <section className="cx-card cx-row between cx-noprint" style={{ marginBottom: 16 }}>
          <div className="cx-stack" style={{ gap: 4 }}>
            <p className="cx-h2">Protect table codes</p>
            <p className="cx-small cx-muted">
              On: ordering from a table and calling a waiter work only from that table’s own QR code, so nobody can send a waiter or a dine-in order to a table from elsewhere. Print the codes again from “Table QR codes” first: cards printed before this was added stop working once it is on.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            className="cx-switch"
            aria-checked={data.signedTables}
            aria-label="Protect table codes"
            onClick={() => save({ signedTables: !data.signedTables }, data.signedTables ? 'Old table codes work again.' : 'Table orders and waiter calls now need the new QR codes.')}
          />
        </section>
      )}

      {data?.business && <BusinessCard business={data.business} save={save} />}

      {data?.prepay && <PrepayCard prepay={data.prepay} save={save} />}

      <div className="cx-grid three cx-noprint">
        {shops.map((i) => {
          const s = data?.shops[i];
          if (!s) return null;
          return (
            <section key={i} className="cx-card cx-stack" style={{ gap: 14 }}>
              <div className="cx-row between">
                <p className="cx-h2">{LOC_TITLES[i]}</p>
                <span className={`cx-pill ${s.paused ? 'cancelled' : 'ready'}`}>{s.paused ? 'Paused' : 'Taking orders'}</span>
              </div>
              <div className="cx-row between" style={{ flexWrap: 'nowrap' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Pause online orders</p>
                  <p className="cx-small cx-muted">Busy, closing early, power cut. The counter still works.</p>
                </div>
                <button type="button" role="switch" className="cx-switch warn" aria-checked={s.paused} aria-label="Pause online orders" onClick={() => save({ loc: i, paused: !s.paused }, s.paused ? 'Taking online orders again.' : 'Online orders paused.')} />
              </div>
              <div>
                <p style={{ fontWeight: 600 }}>Extra wait</p>
                <p className="cx-small cx-muted" style={{ marginBottom: 8 }}>
                  Added to every pickup and delivery time the site promises.
                </p>
                <div className="cx-seg" role="group" aria-label="Extra wait">
                  {[0, 5, 10, 15, 20, 30].map((m) => (
                    <button type="button" key={m} aria-pressed={s.extraMin === m} onClick={() => save({ loc: i, extraMin: m })}>
                      {m ? `+${m}` : 'None'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cx-row between" style={{ flexWrap: 'nowrap' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>Accept automatically</p>
                  <p className="cx-small cx-muted">New orders go straight to the kitchen screen. Off: someone accepts each one on Orders.</p>
                </div>
                <button type="button" role="switch" className="cx-switch" aria-checked={s.autoAccept} aria-label="Accept automatically" onClick={() => save({ loc: i, autoAccept: !s.autoAccept })} />
              </div>
              <div className="cx-row between">
                <label className="cx-row">
                  <span style={{ fontWeight: 600 }}>Tables</span>
                  <input
                    className="cx-input"
                    style={{ width: 80 }}
                    type="number"
                    min={0}
                    max={80}
                    defaultValue={s.tables}
                    onBlur={(e) => +e.target.value !== s.tables && save({ loc: i, tables: +e.target.value }, 'Tables saved.')}
                    aria-label="Number of tables"
                  />
                </label>
                <button type="button" className="cx-btn sm" disabled={!s.tables} onClick={() => setQrShop(i)}>
                  Table QR codes
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {qrShop !== null && <QrSheet loc={qrShop} tables={data?.shops[qrShop]?.tables || 0} origin={window.location.origin} onClose={() => setQrShop(null)} />}
    </>
  );
}

function QrSheet({ loc, tables, origin, onClose }: { loc: number; tables: number; origin: string; onClose: () => void }) {
  const run = useRun();
  // Each card's address carries a signature only the server can make, so a table code cannot be guessed or forged.
  const [loaded, setLoaded] = useState<{ loc: number; tables: number; map: Record<number, string> } | null>(null);
  useEffect(() => {
    run(() => api<{ codes: { n: number; key: string }[] }>(`/api/staff/table-codes?loc=${loc}`)).then((r) => r && setLoaded({ loc, tables, map: Object.fromEntries(r.codes.map((c) => [c.n, c.key])) }));
  }, [loc, tables, run]);
  const keys = loaded && loaded.loc === loc && loaded.tables === tables ? loaded.map : null;
  const codes = useMemo(
    () =>
      keys
        ? Array.from({ length: tables }, (_, i) => {
            const url = `${origin}/?table=${SHOP_CODES[loc]}-${i + 1}&t=${keys[i + 1] || ''}`;
            return { n: i + 1, url, svg: qrSvg(url) };
          })
        : [],
    [loc, tables, origin, keys],
  );
  return (
    <section style={{ marginTop: 22 }}>
      <div className="cx-row between cx-noprint" style={{ marginBottom: 12 }}>
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Table QR codes · {LOC_TITLES[loc]}</p>
          <p className="cx-small cx-muted">Guests scan, order from their table and can call a waiter or ask for the bill. Print on card, one per table.</p>
        </div>
        <div className="cx-row">
          <button type="button" className="cx-btn primary" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="cx-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {!keys && <p className="cx-muted">Making the codes…</p>}
      <div className="cx-qr-grid">
        {codes.map((c) => (
          <figure key={c.n} className="cx-qr">
            <small>BREWNS · {LOC_TITLES[loc].toUpperCase()}</small>
            <span dangerouslySetInnerHTML={{ __html: c.svg }} />
            <b>TABLE {c.n}</b>
            <small>SCAN TO ORDER · CALL A WAITER</small>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** What is printed at the top of every bill: the legal name, the address, and the tax numbers a sales-tax invoice shows. */
function BusinessCard({ business, save }: { business: Business; save: (body: Record<string, unknown>, done?: string) => Promise<unknown> }) {
  const { can } = useMe();
  const [f, setF] = useState(business);
  if (!can('shops.manage')) return null;
  const set = (k: keyof Business) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <section className="cx-card cx-stack cx-noprint" style={{ marginBottom: 16, gap: 12 }}>
      <div className="cx-stack" style={{ gap: 4 }}>
        <p className="cx-h2">Bill details</p>
        <p className="cx-small cx-muted">Printed at the top of every bill the cashier prints. Add your NTN and sales-tax registration number so the bill reads as a proper sales-tax invoice.</p>
      </div>
      <div className="cx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <label className="cx-field">
          <span>Name on the bill</span>
          <input value={f.name} onChange={set('name')} maxLength={60} />
        </label>
        <label className="cx-field">
          <span>Phone</span>
          <input value={f.phone} onChange={set('phone')} maxLength={24} inputMode="tel" />
        </label>
        <label className="cx-field">
          <span>NTN</span>
          <input value={f.ntn} onChange={set('ntn')} maxLength={20} placeholder="e.g. 1234567-8" />
        </label>
        <label className="cx-field">
          <span>Sales-tax registration (PRA)</span>
          <input value={f.strn} onChange={set('strn')} maxLength={24} />
        </label>
        <label className="cx-field" style={{ gridColumn: '1 / -1' }}>
          <span>Address</span>
          <input value={f.address} onChange={set('address')} maxLength={120} placeholder="Head office address" />
        </label>
        <label className="cx-field" style={{ gridColumn: '1 / -1' }}>
          <span>Line at the bottom</span>
          <input value={f.footer} onChange={set('footer')} maxLength={100} />
        </label>
      </div>
      <div className="cx-row">
        <button type="button" className="cx-btn primary" disabled={f.name.trim().length < 2} onClick={() => save({ business: f }, 'Bill details saved.')}>
          Save bill details
        </button>
      </div>
    </section>
  );
}

/** Pay-first delivery: big delivery orders wait for the customer's payment before the kitchen sees them. */
function PrepayCard({ prepay, save }: { prepay: { minTotal: number | null; holdMin: number; payTo: string }; save: (body: Record<string, unknown>, done?: string) => Promise<unknown> }) {
  const { can } = useMe();
  const [min, setMin] = useState(String(prepay.minTotal ?? 2000));
  const [hold, setHold] = useState(String(prepay.holdMin));
  const [payTo, setPayTo] = useState(prepay.payTo);
  const on = prepay.minTotal !== null;
  const send = (minTotal: number | null, done: string) => save({ prepay: { minTotal, holdMin: Number(hold), payTo } }, done);
  if (!can('shops.manage')) return null;
  return (
    <section className="cx-card cx-stack cx-noprint" style={{ marginBottom: 16, gap: 12 }}>
      <div className="cx-row between" style={{ flexWrap: 'nowrap' }}>
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Pay first for delivery</p>
          <p className="cx-small cx-muted">
            Delivery orders at or above the minimum are held until the customer pays by Raast, JazzCash or Easypaisa and you confirm it. Unpaid orders cancel themselves and their stock comes back.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          className="cx-switch"
          aria-checked={on}
          aria-label="Pay first for delivery"
          onClick={() => send(on ? null : Number(min) || 2000, on ? 'Delivery orders are no longer paid in advance.' : 'Big delivery orders are now paid in advance.')}
        />
      </div>
      <div className="cx-row">
        <label className="cx-row cx-small">
          From Rs
          <input className="cx-input" style={{ width: 100 }} type="number" min={100} value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        <label className="cx-row cx-small">
          Hold for
          <input className="cx-input" style={{ width: 70 }} type="number" min={3} max={60} value={hold} onChange={(e) => setHold(e.target.value)} />
          min
        </label>
        <input className="cx-input" style={{ flex: 1, minWidth: 240 }} value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="Where to send the money" aria-label="Where customers send the money" maxLength={200} />
        <button type="button" className="cx-btn" onClick={() => send(on ? Number(min) : null, 'Saved.')}>
          Save
        </button>
      </div>
    </section>
  );
}
