'use client';

import { useEffect, useMemo, useState } from 'react';
import { LOC_TITLES, SHOP_CODES } from '@/lib/catalog';
import { qrSvg } from '@/lib/qr';
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
  const codes = useMemo(() => Array.from({ length: tables }, (_, i) => ({ n: i + 1, url: `${origin}/?table=${SHOP_CODES[loc]}-${i + 1}` })).map((c) => ({ ...c, svg: qrSvg(c.url) })), [loc, tables, origin]);
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
