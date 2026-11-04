'use client';

import { useEffect, useState } from 'react';
import { api, rs } from '@/components/console/api';

type Referral = { code: string; invited: number; earned: number; credits: { code: string; amount: number }[]; give: number; get: number; minOrder: number };

/** Refer a friend: the customer's code and link to share, how it has gone, and the thank-you codes to spend. */
export function ReferCard() {
  const [r, setR] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Referral>('/api/account/referral').then(
      (d) => !cancelled && setR(d),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);
  if (!r) return null;

  const link = `${location.origin}/?ref=${r.code}`;
  const message = `Rs ${r.give} off your first brewns order (Rs ${r.minOrder.toLocaleString('en-US')}+), on me: ${link}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <section className="cx-card cx-stack" aria-labelledby="refer-h">
      <p className="cx-h2" id="refer-h">
        Give {rs(r.give)}, get {rs(r.get)}
      </p>
      <p className="cx-small cx-muted">
        A friend gets {rs(r.give)} off their first order of {rs(r.minOrder)} or more. Once it&apos;s collected or delivered, you get a {rs(r.get)} code of your own.
      </p>
      <div className="cx-row between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <p className="cx-h1" style={{ fontSize: 26, letterSpacing: '0.04em' }}>{r.code}</p>
        <div className="cx-row" style={{ gap: 8 }}>
          <a className="cx-btn sm primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            Share on WhatsApp
          </a>
          <button type="button" className="cx-btn sm" onClick={copy}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>
      {(r.invited > 0 || r.earned > 0) && (
        <p className="cx-small cx-muted">
          {r.invited} friend{r.invited === 1 ? '' : 's'} ordered with your code · {rs(r.earned)} earned
        </p>
      )}
      {r.credits.length > 0 && (
        <div className="cx-stack" style={{ gap: 6 }}>
          <p className="cx-small">Your codes to spend. Type one in the promo box at checkout:</p>
          {r.credits.map((c) => (
            <p key={c.code} className="cx-row between">
              <span className="cx-mono">{c.code}</span>
              <span>{rs(c.amount)} off</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
