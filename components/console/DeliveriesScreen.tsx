'use client';

import { useEffect, useRef, useState } from 'react';
import { DELIVERY, LOC_TITLES, PAY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { api, pkTime, rs, useNow } from './api';
import { chime, useLive, type StaffOrder } from './Live';
import { itemsLine, OrderDrawer, StatusPill } from './OrderBits';
import { useMe } from './Shell';
import { useRun } from './Toasts';

// The customer's exact door when they shared it (at checkout or from the tracker), else the address they typed.
const mapLink = (o: StaffOrder) =>
  o.pin
    ? `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${o.pin.lat},${o.pin.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address}, ${o.area !== null ? DELIVERY.areas[o.area][0] : ''}, Lahore`)}`;

/** While a rider has deliveries on the road, the phone's GPS goes to each every few seconds, so the customer sees the bike move. */
function useShareLocation(numbers: number[]) {
  const [state, setState] = useState<'waiting' | 'on' | 'denied'>('waiting');
  const key = numbers.join(',');
  useEffect(() => {
    if (!key) return;
    if (!navigator.geolocation) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setState('on');
        if (Date.now() - last < 4000) return;
        last = Date.now();
        const fix = { type: 'locate', lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading };
        // A dropped fix is fine: the next one follows in seconds.
        for (const n of key.split(',')) api(`/api/staff/orders/${n}`, fix).catch(() => {});
      },
      (e) => setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'waiting'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    // Phones stop sending location when the screen sleeps: keep it awake while on the road.
    let lock: WakeLockSentinel | null = null;
    const awake = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    };
    awake();
    document.addEventListener('visibilitychange', awake);
    return () => {
      navigator.geolocation.clearWatch(id);
      document.removeEventListener('visibilitychange', awake);
      lock?.release().catch(() => {});
    };
  }, [key]);
  return state;
}
const SHARING = {
  waiting: 'Finding your location… keep this screen open while you ride.',
  on: 'Sharing your location with the customer. The screen stays on while you ride; keep this page open.',
  denied: 'Location is blocked, so the customer only sees an estimate. Allow location for this site in the browser settings.',
};

/** A delivery with no rider this long gets flagged (and chimes once) for the dispatcher. */
const NO_RIDER_ALERT_MS = 5 * 60000;
/** How a rider's GPS looks to the dispatcher: fresh, quiet (over 2 minutes), or never sent. */
const gpsLabel = (t: number | undefined, now: number) => {
  if (!t) return { text: 'No GPS', bad: true };
  const s = Math.max(0, Math.round((now - t) / 1000));
  return s > 120 ? { text: `GPS quiet ${Math.round(s / 60)} min`, bad: true } : { text: `GPS ${s < 60 ? `${s}s` : '1 min'} ago`, bad: false };
};

/** Riders: what's theirs and what's waiting for a rider. Dispatchers: every delivery, with a rider picker. */
export function DeliveriesScreen() {
  const { data, act } = useLive();
  const { me, can } = useMe();
  const run = useRun();
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(0);
  const deliveries = (data?.orders || []).filter((o) => o.mode === 'delivery' && o.status !== 'cancelled');
  const riding = can('delivery.ride');
  const mine = deliveries.filter((o) => o.rider?.id === me.id && !['delivered'].includes(o.status));
  const waiting = deliveries.filter((o) => !o.rider && ['accepted', 'preparing', 'ready', 'received'].includes(o.status));
  const others = deliveries.filter((o) => o.rider && o.rider.id !== me.id);
  const cash = mine.filter((o) => !o.paid && o.pay === 0).reduce((s, o) => s + o.totals.total, 0);
  const sharing = useShareLocation(riding ? mine.filter((o) => o.status === 'onway' || o.status === 'arriving').map((o) => o.number) : []);
  const [codes, setCodes] = useState<Record<number, string>>({});
  const now = useNow(10000);
  const dispatching = can('delivery.assign');
  const late = (o: StaffOrder) => now - o.placed > NO_RIDER_ALERT_MS;
  // One chime per delivery when it has waited too long for a rider.
  const chimed = useRef(new Set<number>());
  const overdue = dispatching ? waiting.filter(late).map((o) => o.number) : [];
  useEffect(() => {
    const fresh = overdue.filter((n) => !chimed.current.has(n));
    if (!fresh.length) return;
    fresh.forEach((n) => chimed.current.add(n));
    chime();
  }, [overdue.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = async (o: StaffOrder, action: Record<string, unknown>, done?: string) => {
    setBusy(o.number);
    await run(() => act(o.number, action), done);
    setBusy(0);
  };

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {riding ? `${mine.length} with you · ${rs(cash)} cash to collect` : `${deliveries.length} open · ${waiting.length} need a rider${overdue.length ? ` · ${overdue.length} waiting over 5 min` : ''}`}
          </p>
          <h1 className="cx-h1">Deliveries</h1>
        </div>
      </div>

      {riding && (
        <section className="cx-stack" style={{ marginBottom: 24 }}>
          <p className="cx-eyebrow">Yours</p>
          {mine.length ? (
            mine.map((o) => (
              <article key={o.number} className="cx-card cx-stack">
                <div className="cx-row between">
                  <b className="cx-h2" style={{ fontSize: 20 }}>
                    {orderNo(o.number)}
                  </b>
                  <StatusPill status={o.status} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 600 }}>{o.name}</p>
                <p>
                  {o.address}, {o.area !== null && DELIVERY.areas[o.area][0]}
                </p>
                <p className="cx-small cx-muted">
                  From {LOC_TITLES[o.loc]} · at the door by {pkTime(o.target)} · {itemsLine(o)}
                </p>
                <p className="cx-mono">{o.paid ? 'PAID' : o.pay === 0 ? `COLLECT ${rs(o.totals.total)} CASH` : `${PAY[o.pay][0]} ON YOUR MACHINE · ${rs(o.totals.total)}`}</p>
                {o.note && <p className="cx-banner" style={{ margin: 0 }}>“{o.note}”</p>}
                {['onway', 'arriving'].includes(o.status) && <p className={`cx-small${sharing === 'on' ? '' : ' cx-muted'}`}>{SHARING[sharing]}</p>}
                <div className="cx-row">
                  <a className="cx-btn" href={`tel:${o.phone.replace(/\s/g, '')}`}>
                    Call {o.name.split(' ')[0]}
                  </a>
                  <a className="cx-btn" href={mapLink(o)} target="_blank" rel="noopener">
                    {o.pin ? 'Directions to door' : 'Map'}
                  </a>
                  <button type="button" className="cx-btn" onClick={() => setOpen(o.number)}>
                    Messages
                  </button>
                </div>
                {o.status === 'ready' && (
                  <button type="button" className="cx-btn primary big" disabled={busy === o.number} onClick={() => step(o, { type: 'pickup' }, 'On the road. The customer can see you on the map.')}>
                    Picked up, leaving now
                  </button>
                )}
                {['accepted', 'preparing', 'received'].includes(o.status) && <p className="cx-small cx-muted">Still being made. You’ll see “Picked up” here when it’s ready at the pass.</p>}
                {o.status === 'onway' && (
                  <button type="button" className="cx-btn big" disabled={busy === o.number} onClick={() => step(o, { type: 'arriving' })}>
                    Nearly there
                  </button>
                )}
                {['onway', 'arriving'].includes(o.status) && o.needsCode && (
                  <label className="cx-field">
                    <span>Customer’s 4-digit code (on their tracking page)</span>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      value={codes[o.number] || ''}
                      onChange={(e) => setCodes((c) => ({ ...c, [o.number]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="0000"
                      className="cx-mono"
                      style={{ fontSize: 22, letterSpacing: '0.3em' }}
                    />
                  </label>
                )}
                {['onway', 'arriving'].includes(o.status) && (
                  <button
                    type="button"
                    className="cx-btn go big"
                    disabled={busy === o.number || (!!o.needsCode && (codes[o.number] || '').length !== 4)}
                    onClick={() => step(o, { type: 'delivered', code: codes[o.number] || '' }, 'Delivered. Thank you!')}
                  >
                    Delivered{!o.paid ? ` · got ${rs(o.totals.total)}` : ''}
                  </button>
                )}
              </article>
            ))
          ) : (
            <p className="cx-empty">Nothing with you right now.</p>
          )}
        </section>
      )}

      <section className="cx-stack" style={{ marginBottom: 24 }}>
        <p className="cx-eyebrow">Waiting for a rider</p>
        {waiting.length ? (
          <div className="cx-grid three">
            {waiting.map((o) => (
              <article key={o.number} className="cx-card cx-stack" style={dispatching && late(o) ? { borderColor: '#e04c38' } : undefined}>
                <div className="cx-row between">
                  <b className="cx-mono">{orderNo(o.number)}</b>
                  <StatusPill status={o.status} />
                </div>
                {dispatching && late(o) && (
                  <p className="cx-small" style={{ color: '#e04c38', fontWeight: 700 }}>
                    No rider for {Math.round((now - o.placed) / 60000)} min
                  </p>
                )}
                <p>
                  {o.area !== null && DELIVERY.areas[o.area][0]} · from {LOC_TITLES[o.loc].split(',')[0]}
                </p>
                <p className="cx-small cx-muted">
                  Door by {pkTime(o.target)} · ~{o.area !== null ? DELIVERY.areas[o.area][4] : '?'} km · {rs(o.totals.total)}
                </p>
                {riding && (
                  <button type="button" className="cx-btn primary" disabled={busy === o.number} onClick={() => step(o, { type: 'take' }, 'It’s yours.')}>
                    Take it
                  </button>
                )}
                {can('delivery.assign') && (
                  <button type="button" className="cx-btn" onClick={() => setOpen(o.number)}>
                    Assign a rider…
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="cx-empty">Every delivery has a rider.</p>
        )}
      </section>

      {can('delivery.assign') && others.length > 0 && (
        <section className="cx-stack">
          <p className="cx-eyebrow">With riders</p>
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Rider</th>
                  <th>Area</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {others.map((o) => (
                  <tr key={o.number} className="click" onClick={() => setOpen(o.number)}>
                    <td className="cx-mono">{orderNo(o.number)}</td>
                    <td>{o.rider?.name}</td>
                    <td>{o.area !== null && DELIVERY.areas[o.area][0]}</td>
                    <td className="cx-mono">{pkTime(o.target)}</td>
                    <td>
                      <StatusPill status={o.status} />
                    </td>
                    <td className="cx-small">
                      {['onway', 'arriving'].includes(o.status)
                        ? (() => {
                            const g = gpsLabel(data?.fixes?.[o.number], now);
                            return <span style={g.bad ? { color: '#e04c38', fontWeight: 700 } : undefined}>{g.text}</span>;
                          })()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open !== null && <OrderDrawer number={open} onClose={() => setOpen(null)} />}
    </>
  );
}
