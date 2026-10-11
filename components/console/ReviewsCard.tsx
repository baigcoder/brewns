'use client';

import { useEffect, useState } from 'react';
import type { Review } from '@/lib/server/reviews';
import { ago, api, useNow } from './api';
import { useMe } from './Shell';
import { useRun } from './Toasts';

type Data = { pending: Review[]; live: Review[] };

const Stars = ({ n }: { n: number }) => <span aria-label={`${n} stars`}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;

/** Reviews from people who have not ordered wait here until someone approves them; a review left through an order's own link goes live by itself. */
export function ReviewsCard() {
  const run = useRun();
  const { can } = useMe();
  const now = useNow(60000);
  const [data, setData] = useState<Data | null>(null);
  const [showLive, setShowLive] = useState(false);
  const manage = can('shops.manage');
  useEffect(() => {
    run(() => api<Data>('/api/staff/reviews')).then((r) => r && setData(r));
  }, [run]);
  const act = async (action: 'approve' | 'delete', id: string, done: string) => {
    const r = await run(() => api<Data>('/api/staff/reviews', { action, id }), done);
    if (r) setData(r);
  };
  const row = (r: Review, buttons: React.ReactNode) => (
    <li key={r.id} className="cx-row between" style={{ alignItems: 'flex-start', padding: '12px 0', borderTop: '1px solid var(--cx-line, rgba(255,255,255,0.1))', gap: 16 }}>
      <div className="cx-stack" style={{ gap: 4, minWidth: 0 }}>
        <p className="cx-small">
          <Stars n={r.stars} /> · <b>{r.name}</b>, {r.place}
          {r.verified ? ' · verified order' : ' · no order'} <span className="cx-muted">· {ago(r.createdAt, now)}</span>
        </p>
        <p style={{ overflowWrap: 'anywhere' }}>{r.quote}</p>
        {r.order && <p className="cx-small cx-muted">Had: {r.order}</p>}
      </div>
      {manage && <div className="cx-row" style={{ flexShrink: 0 }}>{buttons}</div>}
    </li>
  );
  return (
    <section className="cx-card" style={{ marginBottom: 16 }}>
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Reviews{data && data.pending.length > 0 ? ` · ${data.pending.length} waiting` : ''}</p>
          <p className="cx-small cx-muted">A review from someone who has not ordered shows on the site only after you approve it. Reviews left through an order’s own link go live straight away.</p>
        </div>
        {data && data.live.length > 0 && (
          <button type="button" className="cx-btn sm" onClick={() => setShowLive(!showLive)}>
            {showLive ? 'Hide live reviews' : 'Show live reviews'}
          </button>
        )}
      </div>
      {!data ? (
        <p className="cx-muted">Loading…</p>
      ) : (
        <>
          {!data.pending.length ? <p className="cx-empty">Nothing waiting.</p> : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.pending.map((r) =>
              row(
                r,
                <>
                  <button type="button" className="cx-btn sm primary" onClick={() => act('approve', r.id, 'Review is live.')}>
                    Approve
                  </button>
                  <button type="button" className="cx-btn sm danger" onClick={() => act('delete', r.id, 'Review deleted.')}>
                    Delete
                  </button>
                </>,
              ),
            )}
            {showLive &&
              data.live.map((r) =>
                row(
                  r,
                  <button type="button" className="cx-btn sm danger" onClick={() => window.confirm('Take this review off the site?') && act('delete', r.id, 'Review deleted.')}>
                    Delete
                  </button>,
                ),
              )}
          </ul>
        </>
      )}
    </section>
  );
}
