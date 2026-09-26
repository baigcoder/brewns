'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { orderNo, STATION_LABEL, type Station } from '@/lib/orderFlow';
import { pkTime } from './api';
import { chime, useLive, type StaffOrder } from './Live';
import { ShopFilter } from './OrdersScreen';
import { useMe } from './Shell';
import { useRun } from './Toasts';

type Ticket = { o: StaffOrder; station: Station };

/**
 * The kitchen display: a paper ticket per order and station, oldest first.
 * The top stripe turns amber five minutes before the order is due and red
 * once it's late. Tap a line to tick it off; Done sends the station's part
 * to the pass, and the order goes ready when every station is done.
 */
export function KitchenScreen() {
  const { data, act } = useLive();
  const { can, canAny } = useMe();
  const run = useRun();
  const mine: Station[] = [...(canAny('kitchen.bar', 'orders.manage') ? ['bar' as const] : []), ...(canAny('kitchen.food', 'orders.manage') ? ['kitchen' as const] : [])];
  const [view, setView] = useState<Station | 'all'>(mine.length === 1 ? mine[0] : 'all');
  const [shop, setShop] = useState<number | 'all'>('all');
  const [sound, setSound] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<Ticket[]>([]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = () => sound && chime();
    window.addEventListener('brewns:new-orders', on);
    return () => window.removeEventListener('brewns:new-orders', on);
  }, [sound]);

  const stations = view === 'all' ? mine : [view];
  const tickets: Ticket[] = (data?.orders || [])
    .filter((o) => (shop === 'all' || o.loc === shop) && ['received', 'accepted', 'preparing'].includes(o.status))
    .flatMap((o) => stations.filter((s) => o.stations[s] && o.stations[s] !== 'done').map((station) => ({ o, station })))
    .sort((a, b) => a.o.target - b.o.target);
  // Scheduled for later: out of the way until 25 minutes before.
  const soon = tickets.filter((t) => t.o.target - now < 25 * 60000);
  const later = tickets.filter((t) => t.o.target - now >= 25 * 60000);

  const bump = async (t: Ticket, state: 'making' | 'done' | 'queued') => {
    const ok = await run(() => act(t.o.number, { type: 'station', station: t.station, state }));
    if (ok && state === 'done') setDone((d) => [t, ...d].slice(0, 6));
    if (ok && state !== 'done') setDone((d) => d.filter((x) => !(x.o.number === t.o.number && x.station === t.station)));
  };

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {soon.length} ticket{soon.length === 1 ? '' : 's'} now{later.length ? ` · ${later.length} later` : ''}
          </p>
          <h1 className="cx-h1">Kitchen</h1>
        </div>
        <div className="cx-row">
          {mine.length > 1 && (
            <div className="cx-seg" role="group" aria-label="Station">
              <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>
                Both
              </button>
              {mine.map((s) => (
                <button type="button" key={s} aria-pressed={view === s} onClick={() => setView(s)}>
                  {STATION_LABEL[s]}
                </button>
              ))}
            </div>
          )}
          <ShopFilter value={shop} onChange={setShop} />
          <button type="button" className="cx-btn sm ghost" onClick={() => setSound(!sound)} aria-pressed={sound}>
            {sound ? '🔔 Chime on' : '🔕 Chime off'}
          </button>
          {can('menu.availability') && (
            <Link className="cx-btn sm" href="/dashboard/menu">
              Sold out…
            </Link>
          )}
        </div>
      </div>

      {!data ? (
        <p className="cx-empty">Loading tickets…</p>
      ) : !soon.length ? (
        <p className="cx-empty">
          <b>All clear.</b>New tickets appear here by themselves, with a chime.
        </p>
      ) : (
        <div className="cx-kds">
          {soon.map((t) => (
            <TicketCard key={`${t.o.number}-${t.station}`} t={t} now={now} showStation={stations.length > 1} onBump={bump} onLine={(i, d) => run(() => act(t.o.number, { type: 'line', index: i, done: d }))} />
          ))}
        </div>
      )}

      {later.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <p className="cx-eyebrow" style={{ marginBottom: 10 }}>
            Scheduled for later
          </p>
          <div className="cx-row">
            {later.map((t) => (
              <span key={`${t.o.number}-${t.station}`} className="cx-pill plain">
                {orderNo(t.o.number)} · {STATION_LABEL[t.station]} · due {pkTime(t.o.target)}
              </span>
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <p className="cx-eyebrow" style={{ marginBottom: 10 }}>
            Just sent to the pass
          </p>
          <div className="cx-row">
            {done.map((t) => (
              <button key={`${t.o.number}-${t.station}`} type="button" className="cx-btn sm" onClick={() => bump(t, 'making')}>
                ↺ Reopen {orderNo(t.o.number)} · {STATION_LABEL[t.station]}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function TicketCard({ t, now, showStation, onBump, onLine }: { t: Ticket; now: number; showStation: boolean; onBump: (t: Ticket, s: 'making' | 'done') => void; onLine: (i: number, done: boolean) => void }) {
  const { o, station } = t;
  const left = Math.round((o.target - now) / 60000);
  const tone = left < 0 ? 't-late' : left <= 5 ? 't-warn' : 't-ok';
  const state = o.stations[station];
  const lines = o.items.map((l, i) => ({ l, i })).filter(({ l }) => l.station === station);
  const others = o.items.filter((l) => l.station !== station && l.station !== 'counter');
  return (
    <article className={`cx-ticket ${tone}`} aria-label={`Ticket ${orderNo(o.number)}`}>
      <div className="cx-ticket-top">
        <span className="cx-ticket-no">{orderNo(o.number)}</span>
        <span className={`cx-ticket-age${left < 0 ? ' late' : ''}`}>{left < 0 ? `${-left} min late` : `${left} min left`}</span>
      </div>
      <p className="cx-ticket-meta">
        {o.mode === 'dinein' ? `Table ${o.table}` : o.mode === 'delivery' ? 'Delivery' : 'Pickup'} · {o.name.split(' ')[0]} · due {pkTime(o.target)}
        {showStation ? ` · ${STATION_LABEL[station]}` : ''}
        {state === 'making' ? ' · making' : ''}
      </p>
      <div className="cx-ticket-lines">
        {lines.map(({ l, i }) => (
          <button type="button" key={i} className={`cx-ticket-line${l.done ? ' done' : ''}`} onClick={() => onLine(i, !l.done)} aria-pressed={!!l.done}>
            <b>{l.qty}×</b>
            <span>{l.name}</span>
            {l.opts && <small>{l.opts}</small>}
          </button>
        ))}
      </div>
      {o.note && <p className="cx-ticket-note">“{o.note}”</p>}
      {others.length > 0 && <p className="cx-ticket-other">With: {others.map((l) => `${l.qty}× ${l.name.toLowerCase()}`).join(', ')}</p>}
      <div className="cx-row">
        {state === 'queued' ? (
          <button type="button" className="cx-btn primary big" style={{ flex: 1 }} onClick={() => onBump(t, 'making')}>
            Start
          </button>
        ) : (
          <button type="button" className="cx-btn go big" style={{ flex: 1 }} onClick={() => onBump(t, 'done')}>
            Done
          </button>
        )}
      </div>
    </article>
  );
}
