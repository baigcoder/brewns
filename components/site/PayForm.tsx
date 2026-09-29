'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type View = { number: number; status: string; totals: { total: number }; hold: { until: number; ref: string } | null; cancelled: { reason: string } | null };

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

/** Where a pay-first delivery order waits: what to pay, where to send it, the transaction ID, and the clock. */
export default function PayForm({ number, keyToken }: { number: string; keyToken: string }) {
  const url = `/api/orders/${encodeURIComponent(number)}?k=${encodeURIComponent(keyToken)}`;
  const [order, setOrder] = useState<View | null>(null);
  const [missing, setMissing] = useState(false);
  const [payTo, setPayTo] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(
    () =>
      fetch(url, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((r: { order: View }) => {
          setOrder(r.order);
          setMissing(false);
        })
        .catch(() => setOrder((o) => o || (setMissing(true), null))),
    [url],
  );

  useEffect(() => {
    load();
    fetch('/api/public/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: { payTo?: string }) => setPayTo(s.payTo || ''))
      .catch(() => {});
    const poll = setInterval(() => !document.hidden && load(), 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  // Once the café confirms the payment the order is no longer held: on to tracking.
  const confirmed = !!order && !order.hold && order.status !== 'cancelled';
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: the café page's engine starts once per document
    if (confirmed) window.location.assign(`/?track=${encodeURIComponent(number)}&k=${encodeURIComponent(keyToken)}`);
  }, [confirmed, number, keyToken]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await fetch(`/api/orders/${encodeURIComponent(number)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'payref', text: ref, k: keyToken }) });
    if (!r.ok) setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error || 'Something went wrong. Try again.');
    else await load();
    setBusy(false);
  };

  const left = order?.hold ? Math.max(0, order.hold.until - now) : 0;
  const clock = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  const card: React.CSSProperties = { border: '1px solid #444', borderRadius: 12, padding: 16, margin: '16px 0', background: '#111' };

  let body;
  if (missing) body = <p>We could not find that order. Open the link from your message again.</p>;
  else if (!order) body = <p>Loading…</p>;
  else if (order.status === 'cancelled')
    body = (
      <p>
        This order was cancelled{order.cancelled?.reason ? `: ${order.cancelled.reason.toLowerCase()}` : ''}. If you already paid, call the shop and we will sort it out.
      </p>
    );
  else if (confirmed) body = <p>Payment confirmed. Taking you to your order…</p>;
  else
    body = (
      <>
        <div style={card}>
          <p style={{ margin: 0, opacity: 0.7 }}>1. Send</p>
          <p style={{ margin: '4px 0 12px', fontSize: 28, color: '#d58c3d', fontWeight: 600 }}>{rs(order.totals.total)}</p>
          <p style={{ margin: 0, opacity: 0.7 }}>to</p>
          <p style={{ margin: '4px 0 0', fontFamily: 'ui-monospace, monospace' }}>{payTo || 'brewns'}</p>
        </div>
        <form onSubmit={send} style={card}>
          <label htmlFor="ref" style={{ opacity: 0.7 }}>
            2. Enter the transaction ID from your receipt
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input id="ref" value={ref} onChange={(e) => setRef(e.target.value.replace(/[^A-Za-z0-9-]/g, ''))} maxLength={30} placeholder={order.hold?.ref || 'e.g. 3847291056'} autoComplete="off" style={{ flex: 1, minWidth: 180, padding: 12, borderRadius: 10, border: '1px solid #444', background: '#070707', color: 'inherit', font: 'inherit' }} />
            <button disabled={busy || ref.length < 6} style={{ background: '#d58c3d', color: '#070707', border: 0, borderRadius: 999, padding: '12px 24px', font: 'inherit', fontWeight: 600, cursor: 'pointer', opacity: ref.length < 6 ? 0.5 : 1 }}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
          {error && (
            <p role="alert" style={{ color: '#ff8a7a' }}>
              {error}
            </p>
          )}
          {order.hold?.ref && <p style={{ marginBottom: 0 }}>Got it: {order.hold.ref}. The café is checking it now. This page updates by itself.</p>}
        </form>
        <p>
          We hold your order for <b style={{ color: '#d58c3d' }}>{clock}</b>. If the payment has not arrived by then, it is cancelled.
        </p>
      </>
    );

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 20px', color: '#f3e9d8', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#d58c3d', fontWeight: 600 }}>Pay for order #{number.padStart(5, '0')}</h1>
      {body}
      <p style={{ marginTop: 32 }}>
        <Link href="/" style={{ color: '#d58c3d' }}>
          ← Back to brewns
        </Link>
      </p>
    </main>
  );
}
