'use client';

import { useEffect, useState } from 'react';
import { DELIVERY, LOC_TITLES, PAY } from '@/lib/catalog';
import { isOpen, MODE_LABEL, orderNo, STATUS_LABEL, type Status } from '@/lib/orderFlow';
import { ago, pkTime, rs, useNow } from './api';
import { useLive, type StaffOrder } from './Live';
import { useMe } from './Shell';
import { useRun } from './Toasts';

export const isLate = (o: StaffOrder, now = Date.now()) => isOpen(o.status) && !['onway', 'arriving'].includes(o.status) && now > o.target + 2 * 60000 && o.status !== 'ready';

export function StatusPill({ status, late }: { status: Status; late?: boolean }) {
  return <span className={`cx-pill ${late ? 'late' : status}`}>{late ? `Late · ${STATUS_LABEL[status]}` : STATUS_LABEL[status]}</span>;
}

export const ModeTag = ({ o }: { o: Pick<StaffOrder, 'mode' | 'table'> }) => <span className={`cx-mode ${o.mode}`}>{o.mode === 'dinein' ? `Table ${o.table}` : MODE_LABEL[o.mode]}</span>;

export const itemsLine = (o: StaffOrder) => o.items.map((i) => `${i.qty}× ${i.name.toLowerCase()}`).join(', ');

export const unread = (o: StaffOrder) => o.messages.filter((m) => m.from === 'you').length - o.readByCafe;

export function OrderCard({ o, onOpen, now }: { o: StaffOrder; onOpen: () => void; now: number }) {
  const { fresh } = useLive();
  const late = isLate(o, now);
  const u = unread(o);
  return (
    <button type="button" className={`cx-ocard${late ? ' late' : ''}${fresh.has(o.number) ? ' fresh' : ''}`} onClick={onOpen}>
      <div className="cx-ocard-top">
        <span className="cx-ocard-no">{orderNo(o.number)}</span>
        <span className="cx-mono cx-small cx-muted">{ago(o.placed, now)}</span>
      </div>
      <div className="cx-row between">
        <ModeTag o={o} />
        <StatusPill status={o.status} late={late} />
      </div>
      <p style={{ fontWeight: 600 }}>{o.name}</p>
      <p className="cx-ocard-items">{itemsLine(o)}</p>
      <div className="cx-row between">
        <span className="cx-mono cx-small">{rs(o.totals.total)}</span>
        <span className="cx-mono cx-small cx-muted">
          {o.mode === 'delivery' ? 'Door by' : 'Ready by'} {pkTime(o.target)}
        </span>
      </div>
      {(u > 0 || o.note || (o.club?.used && !o.club.verified)) && (
        <div className="cx-row">
          {u > 0 && <span className="cx-unread">● {u} new message{u === 1 ? '' : 's'}</span>}
          {o.note && <span className="cx-small cx-muted">Note: “{o.note}”</span>}
          {o.club?.used && !o.club.verified && <span className="cx-small" style={{ color: 'var(--cx-new)' }}>Club drink: check their card</span>}
        </div>
      )}
    </button>
  );
}

/** Everything about one order, and the steps this person may take on it. */
export function OrderDrawer({ number, fallback, onClose }: { number: number; fallback?: StaffOrder; onClose: () => void }) {
  const { data, act } = useLive();
  const { can, canAny, me } = useMe();
  const run = useRun();
  const o = data?.orders.find((x) => x.number === number) || fallback;
  const [method, setMethod] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow(15000);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const n = o ? unread(o) : 0;
  useEffect(() => {
    if (o && n > 0 && canAny('orders.view', 'messages.reply')) act(o.number, { type: 'read' }).catch(() => {});
  }, [o?.number, n]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!o) return null;
  const late = isLate(o, now);
  const step = async (action: Record<string, unknown>, done?: string) => {
    setBusy(true);
    await run(() => act(o.number, action), done);
    setBusy(false);
  };
  const open = isOpen(o.status);
  const riders = data?.riders || [];
  const t = o.totals;

  return (
    <div className="cx-drawer-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="cx-drawer" role="dialog" aria-modal="true" aria-label={`Order ${orderNo(o.number)}`}>
        <div className="cx-row between">
          <div className="cx-stack" style={{ gap: 6 }}>
            <p className="cx-eyebrow">
              <b>{'//'}</b> {LOC_TITLES[o.loc]} · {o.source === 'online' ? 'Online' : o.source === 'table' ? 'Table' : 'Counter'}
              {o.demo ? ' · sample' : ''}
            </p>
            <h2 className="cx-h1" style={{ fontSize: 28 }}>
              {orderNo(o.number)}
            </h2>
          </div>
          <button type="button" className="cx-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="cx-row">
          <StatusPill status={o.status} late={late} />
          <ModeTag o={o} />
          <span className={`cx-pill plain${o.paid ? ' ready' : ''}`}>{o.paid ? `Paid · ${PAY[o.paid.method][0]}` : `Unpaid · ${PAY[o.pay][0]}`}</span>
        </div>

        <div className="cx-card cx-stack" style={{ gap: 6 }}>
          <p style={{ fontWeight: 600, fontSize: 16 }}>{o.name}</p>
          {o.phone && (
            <a className="cx-link cx-mono" href={`tel:${o.phone.replace(/\s/g, '')}`}>
              {o.phone}
            </a>
          )}
          {o.mode === 'delivery' && (
            <p className="cx-muted">
              {o.address}
              {o.area !== null && `, ${DELIVERY.areas[o.area][0]}`}
            </p>
          )}
          <p className="cx-muted cx-small">
            Placed {pkTime(o.placed)} · {o.mode === 'delivery' ? 'at the door by' : 'ready by'} <b style={{ color: late ? 'var(--cx-late)' : undefined }}>{pkTime(o.target)}</b>
            {o.pickupAt.tomorrow ? ' tomorrow' : ''}
          </p>
          {o.rider && (
            <p className="cx-small">
              Rider: <b>{o.rider.name}</b> {o.rider.plate && <span className="cx-mono cx-muted">· {o.rider.plate}</span>}
            </p>
          )}
        </div>

        <div className="cx-lines">
          {o.items.map((l, i) => (
            <div key={i} className="cx-line">
              <b>{l.qty}×</b>
              <span>{l.name}</span>
              <span className="cx-mono cx-small">{rs(l.total)}</span>
              {l.opts && <small>{l.opts}</small>}
            </div>
          ))}
        </div>
        {o.note && <p className="cx-banner" style={{ margin: 0 }}>Note: “{o.note}”</p>}
        {o.club?.used && (
          <p className="cx-small" style={{ color: o.club.verified ? 'var(--cx-muted)' : 'var(--cx-new)' }}>
            {o.club.verified ? '★ Club free drink, taken off their account card.' : '★ Club free drink from a card kept on their phone: ask to see it before handing over.'}
          </p>
        )}
        <div className="cx-sums cx-num">
          <div>
            <span className="cx-muted">Subtotal</span>
            <span>{rs(t.sub)}</span>
          </div>
          {t.reward > 0 && (
            <div>
              <span className="cx-muted">Club free drink</span>
              <span>−{rs(t.reward)}</span>
            </div>
          )}
          {t.promo > 0 && (
            <div>
              <span className="cx-muted">Promo {o.promoCode}</span>
              <span>−{rs(t.promo)}</span>
            </div>
          )}
          {o.mode === 'delivery' && (
            <div>
              <span className="cx-muted">Delivery</span>
              <span>{t.fee ? rs(t.fee) : 'Free'}</span>
            </div>
          )}
          <div>
            <span className="cx-muted">Sales tax {Math.round(t.rate * 100)}%</span>
            <span>{rs(t.tax)}</span>
          </div>
          <div className="total">
            <span>Total</span>
            <span>{rs(t.total)}</span>
          </div>
        </div>

        {/* The next step, big; then the rest. */}
        <div className="cx-stack">
          {o.status === 'received' && can('orders.manage') && (
            <button className="cx-btn primary big" disabled={busy} onClick={() => step({ type: 'accept' }, 'Accepted: it’s on the kitchen screen.')}>
              Accept order
            </button>
          )}
          {['accepted', 'preparing'].includes(o.status) && can('orders.manage') && (
            <button className="cx-btn go big" disabled={busy} onClick={() => step({ type: 'ready' })}>
              Mark ready
            </button>
          )}
          {o.status === 'ready' && o.mode === 'pickup' && can('orders.manage') && (
            <button className="cx-btn go big" disabled={busy} onClick={() => step({ type: 'collected' }, 'Handed over.')}>
              Handed over{o.paid ? '' : ` · take ${rs(t.total)}`}
            </button>
          )}
          {o.status === 'ready' && o.mode === 'dinein' && canAny('floor.tables', 'orders.manage') && (
            <button className="cx-btn go big" disabled={busy} onClick={() => step({ type: 'served' })}>
              Served to table {o.table}
            </button>
          )}
          {o.mode === 'delivery' && ['received', 'accepted', 'preparing', 'ready'].includes(o.status) && can('delivery.assign') && (
            <label className="cx-field">
              <span>Rider</span>
              <select value={o.rider?.id || ''} disabled={busy} onChange={(e) => e.target.value && step({ type: 'assign', riderId: e.target.value }, 'Rider assigned.')}>
                <option value="">{riders.length ? 'Choose a rider…' : 'No riders on the team yet'}</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.online ? ' · online' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {o.mode === 'delivery' && o.status === 'ready' && o.rider && can('orders.manage') && (
            <button className="cx-btn primary big" disabled={busy} onClick={() => step({ type: 'pickup' })}>
              Out with {o.rider.name.split(' ')[0]}
            </button>
          )}
          {['onway', 'arriving'].includes(o.status) && can('orders.manage') && (
            <button className="cx-btn go big" disabled={busy} onClick={() => step({ type: 'delivered' })}>
              Delivered
            </button>
          )}
          {!o.paid && o.status !== 'cancelled' && can('orders.pay') && (
            <div className="cx-row">
              <select className="cx-select" value={method ?? o.pay} onChange={(e) => setMethod(+e.target.value)} aria-label="Paid by">
                {PAY.map((p, i) => (
                  <option key={i} value={i}>
                    {p[0]}
                  </option>
                ))}
              </select>
              <button className="cx-btn" disabled={busy} onClick={() => step({ type: 'paid', method: method ?? o.pay }, `Paid: ${rs(t.total)}.`)}>
                Take payment · {rs(t.total)}
              </button>
            </div>
          )}
          {open && can('orders.manage') && (
            <div className="cx-row">
              <span className="cx-small cx-muted">Running behind?</span>
              {[5, 10, 15].map((m) => (
                <button key={m} className="cx-btn sm" disabled={busy} onClick={() => step({ type: 'delay', min: m }, `Customer told: ${m} minutes later.`)}>
                  +{m} min
                </button>
              ))}
              <button
                className="cx-btn sm danger"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt('Why is it cancelled? The customer sees this.', 'Sorry, we’ve run out of something in your order.');
                  if (reason !== null) step({ type: 'cancel', reason }, 'Cancelled.');
                }}
              >
                Cancel order
              </button>
            </div>
          )}
          {o.status === 'cancelled' && <p className="cx-small" style={{ color: 'var(--cx-late)' }}>Cancelled: {o.cancelReason}</p>}
        </div>

        {(o.messages.length > 0 || (o.source === 'online' && canAny('messages.reply'))) && (
          <div className="cx-card cx-stack">
            <p className="cx-h2">Messages</p>
            <div className="cx-chat">
              {o.messages.length ? (
                o.messages.map((m) => (
                  <div key={m.id} className={`cx-msg ${m.from === 'you' ? 'them' : 'us'}`}>
                    {m.text}
                    <small>
                      {m.from === 'you' ? o.name.split(' ')[0] : m.by || 'Café'} · {pkTime(m.t)}
                    </small>
                  </div>
                ))
              ) : (
                <p className="cx-small cx-muted">No messages yet. The customer sees what you write here on their tracker.</p>
              )}
            </div>
            {(can('messages.reply') || o.rider?.id === me.id) && o.source === 'online' && (
              <form
                className="cx-chat-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!text.trim()) return;
                  const ok = await run(() => act(o.number, { type: 'message', text }));
                  if (ok) setText('');
                }}
              >
                <input className="cx-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Reply to the customer…" aria-label="Reply" />
                <button className="cx-btn primary">Send</button>
              </form>
            )}
          </div>
        )}

        <div className="cx-stack">
          <p className="cx-h2">History</p>
          <ol className="cx-timeline">
            {o.events.map((e, i) => (
              <li key={i}>
                <time>{pkTime(e.t)}</time>
                <span>
                  {eventText(e.what, e.status)}
                  {e.by ? <span className="cx-faint"> · {e.by}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function eventText(what: string, status?: Status) {
  if (what === 'placed') return 'Order placed';
  if (what === 'rider') return 'Rider assigned';
  if (what === 'paid') return 'Paid';
  if (what.startsWith('delay:')) return `Pushed back ${what.slice(6)} min`;
  const st = /^(bar|kitchen|counter):(queued|making|done)$/.exec(what);
  if (st) return `${st[1] === 'bar' ? 'Bar' : st[1] === 'kitchen' ? 'Kitchen' : 'Counter'} ${st[2] === 'making' ? 'started' : st[2] === 'done' ? 'finished' : 'reopened'}`;
  return status ? STATUS_LABEL[status] : what;
}
