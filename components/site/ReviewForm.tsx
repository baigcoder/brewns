'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Info = { number: number; name: string; shop: string; items: string[]; reason: '' | 'notyet' | 'already' };

/** The page a customer lands on from the "how was it?" message: stars and a few words, for one verified review. */
export default function ReviewForm({ number, keyToken }: { number: string; keyToken: string }) {
  const url = `/api/orders/${encodeURIComponent(number)}/review?k=${encodeURIComponent(keyToken)}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [stars, setStars] = useState(0);
  const [quote, setQuote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo, () => setMissing(true));
  }, [url]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError('');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars, quote }) });
    if (r.ok) return setState('done');
    setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error || 'Something went wrong. Try again.');
    setState('idle');
  };

  const ready = stars > 0 && quote.trim().length >= 3;
  let body;
  if (missing) body = <p>We could not find that order. Open the link from your message again.</p>;
  else if (!info) body = <p>Loading…</p>;
  else if (state === 'done') body = <p>Thank you{info.name ? `, ${info.name.split(' ')[0]}` : ''}! Your review is on the site with a verified-order stamp.</p>;
  else if (info.reason === 'already') body = <p>This order has already been reviewed. Thank you!</p>;
  else if (info.reason === 'notyet') body = <p>You can rate this order once you have it. Come back then.</p>;
  else
    body = (
      <form onSubmit={submit}>
        <p style={{ opacity: 0.8 }}>
          {info.items.slice(0, 3).join(', ').toLowerCase()} · {info.shop}
        </p>
        <div role="radiogroup" aria-label="Stars" style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => setStars(n)}
              style={{ fontSize: 34, lineHeight: 1, background: 'none', border: 0, cursor: 'pointer', color: n <= stars ? '#d58c3d' : '#555' }}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="A few words about it"
          aria-label="Your review"
          style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #444', background: '#111', color: 'inherit', font: 'inherit' }}
        />
        {error && (
          <p role="alert" style={{ color: '#ff8a7a' }}>
            {error}
          </p>
        )}
        <button disabled={!ready || state === 'sending'} style={{ marginTop: 16, background: '#d58c3d', color: '#070707', border: 0, borderRadius: 999, padding: '12px 28px', font: 'inherit', fontWeight: 600, cursor: 'pointer', opacity: ready ? 1 : 0.5 }}>
          {state === 'sending' ? 'Sending…' : 'Post my review'}
        </button>
      </form>
    );

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '64px 20px', color: '#f3e9d8', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: '#d58c3d', fontWeight: 600 }}>How was order #{number.padStart(5, '0')}?</h1>
      {body}
      <p style={{ marginTop: 32 }}>
        <Link href="/" style={{ color: '#d58c3d' }}>
          ← Back to brewns
        </Link>
      </p>
    </main>
  );
}
