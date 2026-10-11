'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

type Step = { event: string; label: string; count: number; ofVisits: number | null; ofPrevious: number | null };
type Funnel = { days: number; steps: Step[] };

/** Visits through to orders, from the site's anonymous daily counts. Shows where people drop off. */
export function FunnelCard() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Funnel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api<Funnel>(`/api/staff/funnel?days=${days}`)
      .then((d) => live && (setData(d), setFailed(false)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [days]);

  const steps = data?.days === days ? data.steps : null;
  const top = Math.max(1, ...(steps?.map((s) => s.count) ?? [1]));
  const empty = !!steps && steps[0].count === 0;
  // The biggest single drop between two steps, to point at where to look first.
  const worst = steps
    ? steps.slice(1).reduce<Step | null>((w, s) => (s.ofPrevious !== null && (w === null || s.ofPrevious < (w.ofPrevious ?? 101)) ? s : w), null)
    : null;

  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <p className="cx-h2">Where visitors drop off</p>
        <div className="cx-row" style={{ gap: 6 }} role="group" aria-label="Funnel range">
          {([7, 30] as const).map((d) => (
            <button key={d} type="button" className={`cx-btn sm${days === d ? ' primary' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="cx-muted">Could not load the funnel. Try again in a moment.</p>
      ) : !steps ? (
        <p className="cx-muted">Loading…</p>
      ) : empty ? (
        <p className="cx-muted">No visits counted yet. Numbers appear here as people use the site (visitors who send Do Not Track are not counted).</p>
      ) : (
        <>
          <div className="cx-stack" style={{ gap: 12 }}>
            {steps.map((s) => (
              <div key={s.event}>
                <div className="cx-row between" style={{ flexWrap: 'nowrap', marginBottom: 4 }}>
                  <span>{s.label}</span>
                  <span className="cx-small">
                    <b className="cx-num">{s.count.toLocaleString('en-US')}</b>
                    {s.ofVisits !== null && <span className="cx-muted"> · {s.ofVisits}% of visits</span>}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgb(255 255 255 / 0.07)' }} role="presentation">
                  <div style={{ width: `${(s.count / top) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--cx-accent)', minWidth: s.count ? 4 : 0 }} />
                </div>
              </div>
            ))}
          </div>
          {worst && worst.ofPrevious !== null && (
            <p className="cx-small cx-muted" style={{ marginTop: 14 }}>
              Biggest drop: only {worst.ofPrevious}% of people who got to the step before went on to “{worst.label.toLowerCase()}”.
            </p>
          )}
        </>
      )}
    </section>
  );
}
