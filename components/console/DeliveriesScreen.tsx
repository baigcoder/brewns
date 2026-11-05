'use client';

import { useEffect, useState } from 'react';
import { DELIVERY, LOC_TITLES, PAY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { api, pkTime, rs } from './api';
import { useLive, type StaffOrder } from './Live';
import { itemsLine, OrderDrawer, StatusPill } from './OrderBits';
import { useMe } from './Shell';
import { useRun } from './Toasts';

// The customer's exact door when they shared it from the tracker, else the address they typed.
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
    return () => navigator.geolocation.clearWatch(id);
  }, [key]);
  return state;
}
const SHARING = {
  waiting: 'Finding your location… keep this screen open while you ride.',
  on: 'Sharing your location with the customer. Keep this screen open while you ride.',
  denied: 'Location is blocked, so the customer only sees an estimate. Allow location for this site in the browser settings.',
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
            <b>{'//'}</b> {riding ? `${mine.length} with you · ${rs(cash)} cash to collect` : `${deliveries.length} open · ${waiting.length} need a rider`}
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
                {['onway', 'arriving'].includes(o.status) && (
                  <button type="button" className="cx-btn go big" disabled={busy === o.number} onClick={() => step(o, { type: 'delivered' }, 'Delivered. Thank you!')}>
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
              <article key={o.number} className="cx-card cx-stack">
                <div className="cx-row between">
                  <b className="cx-mono">{orderNo(o.number)}</b>
                  <StatusPill status={o.status} />
                </div>
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
