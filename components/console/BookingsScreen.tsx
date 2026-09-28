'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { ago, api, rs, useNow } from './api';
import { chime } from './Live';
import { useMe } from './Shell';
import { useRun } from './Toasts';

type Reservation = { id: string; code: string; name: string; phone: string; email?: string; emailSent?: boolean; loc: number; date: string; time: string; guests: number; area: string; notes: string; status: string; createdAt: number };
type Party = { id: string; code: string; type: string; name?: string; phone?: string; email?: string; loc?: number; location: string; date?: string; time?: string; guests: number; status: string; notes: string; source?: string; createdAt: number };
type Outcome = { kind: 'table' | 'party' | 'bag' | 'email'; code?: string; summary: string; total?: number; email?: string };
type CallLog = { id: string; startedAt: number; lastAt: number; endedAt?: number; agent: string; langs: ('en' | 'ur')[]; brain: string; turns: { who: 'caller' | 'agent'; text: string; t: number }[]; outcomes: Outcome[]; live: boolean };
type Data = { v: number; now: number; reservations: Reservation[]; parties: Party[]; calls: CallLog[]; canSeeCalls: boolean };

const pkDate = (t: number) => new Date(t + 5 * 3600_000).toISOString().slice(0, 10);
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const spokenTime = (hm?: string) => {
  if (!hm || !/^\d{2}:\d{2}$/.test(hm)) return hm || '';
  const [h, m] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const dayLabel = (date: string | undefined, today: string) => {
  if (!date) return '';
  if (date === today) return 'Today';
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const isUrdu = (s: string) => /[؀-ۿ]/.test(s);

/** One call: who, how long, what it came to, and the words, as they're spoken. */
function CallCard({ c, now, open, onToggle }: { c: CallLog; now: number; open: boolean; onToggle: () => void }) {
  const end = c.live ? now : c.endedAt || c.lastAt;
  const tail = useRef<HTMLDivElement>(null);
  const turns = c.turns.length;
  useEffect(() => {
    if (open && c.live) tail.current?.scrollTo({ top: tail.current.scrollHeight });
  }, [open, c.live, turns]);
  return (
    <article className={`cx-card cx-aicall${c.live ? ' live' : ''}`}>
      <button type="button" className="cx-aicall-head" onClick={onToggle} aria-expanded={open}>
        <span className="cx-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {c.live ? <span className="cx-pill ready">On the line</span> : <span className="cx-pill plain">Ended</span>}
          <b>{c.agent}</b>
          <span className="cx-small cx-muted">
            {mmss(Math.max(0, end - c.startedAt))} · <bdi>{c.langs.map((l) => (l === 'ur' ? 'اردو' : 'EN')).join(' / ')}</bdi> · {ago(c.startedAt, now)}
          </span>
        </span>
        <span className="cx-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {c.outcomes.map((o, i) => (
            <span key={i} className={`cx-pill ${o.kind === 'bag' ? 'preparing' : o.kind === 'email' ? 'ready' : 'received'}`}>
              {o.kind === 'table' ? `Table ${o.code}` : o.kind === 'party' ? `Party ${o.code}` : o.kind === 'email' ? `✉️ ${o.email || o.summary.replace(/^Confirmation email sent to /, '')}` : `Bag ${o.total ? rs(o.total) : ''}`}
            </span>
          ))}
          {!c.outcomes.length && !c.live && <span className="cx-small cx-faint">No booking</span>}
        </span>
      </button>
      {open && (
        <div className="cx-transcript" ref={tail}>
          {c.outcomes.map((o, i) => (
            <p key={`o${i}`} className="cx-small cx-outcome">
              {o.kind === 'bag' ? 'Put in bag: ' : o.kind === 'email' ? 'Email: ' : 'Booked: '}
              {o.summary}
              {o.total ? ` · ${rs(o.total)}` : ''}
            </p>
          ))}
          {c.turns.map((t, i) => (
            <p key={i} className={`cx-line ${t.who}`} dir={isUrdu(t.text) ? 'rtl' : 'ltr'}>
              <span className="cx-line-who">{t.who === 'caller' ? 'Caller' : c.agent}</span>
              {t.text}
            </p>
          ))}
          {c.live && <p className="cx-small cx-muted cx-listening">Listening…</p>}
        </div>
      )}
    </article>
  );
}

/** Bookings & AI calls: tables, parties and the voice concierge, live. */
export function BookingsScreen() {
  const run = useRun();
  const { canAny } = useMe();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'calls' | 'parties'>('upcoming');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const v = useRef<number | null>(null);
  const liveIds = useRef<Set<string> | null>(null);
  const now = useNow(1000);
  const canAct = canAny('floor.tables', 'orders.manage', 'reports.view');

  const load = useCallback(async () => {
    try {
      const r = await api<Data & { same?: boolean }>(`/api/staff/bookings${v.current !== null ? `?v=${v.current}` : ''}`);
      if (r.same) return;
      v.current = r.v;
      // A new call on the line: chime, and open it so its words show as they come.
      const nowLive = new Set(r.calls.filter((c) => c.live).map((c) => c.id));
      if (liveIds.current) {
        const fresh = [...nowLive].filter((id) => !liveIds.current!.has(id));
        if (fresh.length) {
          chime();
          setOpen((o) => new Set([...o, ...fresh]));
        }
      } else if (nowLive.size) {
        // Calls already going when the screen opens: show their words straight away.
        setOpen((o) => new Set([...o, ...nowLive]));
      }
      liveIds.current = nowLive;
      setData(r);
    } catch {
      /* the next poll tries again */
    }
  }, []);

  useEffect(() => {
    let timer = 0;
    const loop = async () => {
      await load();
      timer = window.setTimeout(loop, document.hidden ? 15000 : 3000);
    };
    loop();
    return () => clearTimeout(timer);
  }, [load]);

  const setStatus = async (kind: 'table' | 'party', id: string, status: string) => {
    await run(() => api('/api/staff/bookings', { kind, id, status }), status === 'cancelled' ? 'Booking cancelled.' : 'Booking updated.');
    v.current = null;
    load();
  };

  const today = pkDate(now);
  const calls = useMemo(() => data?.calls || [], [data]);
  const stats = useMemo(() => {
    const todays = calls.filter((c) => pkDate(c.startedAt) === today);
    const outcomes = todays.flatMap((c) => c.outcomes);
    const ended = todays.filter((c) => !c.live);
    return {
      live: calls.filter((c) => c.live).length,
      calls: todays.length,
      booked: outcomes.filter((o) => o.kind !== 'bag').length,
      bag: outcomes.filter((o) => o.kind === 'bag').reduce((s, o) => s + (o.total || 0), 0),
      urdu: todays.filter((c) => c.langs.includes('ur')).length,
      avg: ended.length ? ended.reduce((s, c) => s + ((c.endedAt || c.lastAt) - c.startedAt), 0) / ended.length : 0,
      converted: todays.length ? Math.round((todays.filter((c) => c.outcomes.length).length / todays.length) * 100) : 0,
    };
  }, [calls, today]);

  const upcoming = (data?.reservations || []).filter((r) => r.date >= today);
  const tonight = upcoming.filter((r) => r.date === today && r.status !== 'cancelled');
  const parties = data?.parties || [];
  const liveCalls = calls.filter((c) => c.live);
  const toggle = (id: string) => setOpen((o) => (o.has(id) ? new Set([...o].filter((x) => x !== id)) : new Set([...o, id])));

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> Live · updates every few seconds
          </p>
          <h1 className="cx-h1">Bookings &amp; AI calls</h1>
        </div>
      </div>

      {!data ? (
        <p className="cx-empty">Loading bookings…</p>
      ) : (
        <>
          <div className="cx-kpis" style={{ marginBottom: 14 }}>
            {data.canSeeCalls && (
              <>
                <div className="cx-kpi">
                  <span className="cx-eyebrow">On the line now</span>
                  <span className="cx-kpi-v">{stats.live}</span>
                  <span className="cx-kpi-d">{stats.calls} AI calls today</span>
                </div>
                <div className="cx-kpi">
                  <span className="cx-eyebrow">Booked by AI today</span>
                  <span className="cx-kpi-v">{stats.booked}</span>
                  <span className="cx-kpi-d">{stats.converted}% of calls booked or ordered</span>
                </div>
                <div className="cx-kpi">
                  <span className="cx-eyebrow">Put in bags by AI</span>
                  <span className="cx-kpi-v">{rs(stats.bag)}</span>
                  <span className="cx-kpi-d">{stats.urdu} calls in Urdu · avg {mmss(stats.avg)}</span>
                </div>
              </>
            )}
            <div className="cx-kpi">
              <span className="cx-eyebrow">Tables today</span>
              <span className="cx-kpi-v">{tonight.length}</span>
              <span className="cx-kpi-d">{tonight.reduce((s, r) => s + r.guests, 0)} guests expected</span>
            </div>
          </div>

          {data.canSeeCalls && liveCalls.length > 0 && (
            <section className="cx-stack" style={{ gap: 10, marginBottom: 16 }}>
              <p className="cx-h2">On the line now</p>
              {liveCalls.map((c) => (
                <CallCard key={c.id} c={c} now={now} open={open.has(c.id)} onToggle={() => toggle(c.id)} />
              ))}
            </section>
          )}

          <div className="cx-seg" role="group" aria-label="Show" style={{ marginBottom: 12 }}>
            <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
              Tables <span className="cx-badge">{upcoming.filter((r) => r.status !== 'cancelled').length}</span>
            </button>
            <button type="button" aria-pressed={tab === 'parties'} onClick={() => setTab('parties')}>
              Parties <span className="cx-badge">{parties.filter((p) => p.status !== 'cancelled' && p.status !== 'done').length}</span>
            </button>
            {data.canSeeCalls && (
              <button type="button" aria-pressed={tab === 'calls'} onClick={() => setTab('calls')}>
                AI call log <span className="cx-badge">{calls.length}</span>
              </button>
            )}
          </div>

          {tab === 'upcoming' &&
            (upcoming.length ? (
              <div className="cx-table-wrap">
                <table className="cx-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Guest</th>
                      <th>Table</th>
                      <th>Shop</th>
                      <th>Status</th>
                      {canAct && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((r) => (
                      <tr key={r.id} style={r.status === 'cancelled' ? { opacity: 0.5 } : undefined}>
                        <td>
                          <b>{dayLabel(r.date, today)}</b> {spokenTime(r.time)}
                        </td>
                        <td>
                          <b>{r.name}</b>
                          <br />
                          <a className="cx-link cx-small" href={`tel:${r.phone.replace(/\s/g, '')}`}>
                            {r.phone}
                          </a>
                          {r.email && (
                            <div style={{ marginTop: 2 }}>
                              <a className="cx-link cx-small" href={`mailto:${r.email}`} style={{ color: '#c99355' }}>
                                ✉️ {r.email}
                              </a>
                              {r.emailSent && (
                                <span className="cx-pill ready" style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px' }}>
                                  Email sent
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {r.guests} · {r.area}
                          <br />
                          <span className="cx-small cx-muted cx-mono">{r.code}</span>
                          {/AI voice call/i.test(r.notes) && <span className="cx-pill plain" style={{ marginLeft: 6 }}>AI call</span>}
                        </td>
                        <td>{LOC_TITLES[r.loc] || '—'}</td>
                        <td>
                          <span className={`cx-pill ${r.status === 'seated' ? 'ready' : r.status === 'cancelled' ? 'cancelled' : 'received'}`}>{r.status}</span>
                        </td>
                        {canAct && (
                          <td className="cx-row" style={{ gap: 6 }}>
                            {r.status === 'confirmed' && (
                              <button type="button" className="cx-btn sm primary" onClick={() => setStatus('table', r.id, 'seated')}>
                                Seat
                              </button>
                            )}
                            {r.status !== 'cancelled' && r.status !== 'seated' && (
                              <button type="button" className="cx-btn sm" onClick={() => window.confirm(`Cancel ${r.name}'s table?`) && setStatus('table', r.id, 'cancelled')}>
                                Cancel
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cx-empty">No table bookings coming up. New ones, from the website or an AI call, appear here straight away.</p>
            ))}

          {tab === 'parties' &&
            (parties.length ? (
              <div className="cx-grid three">
                {parties.map((p) => (
                  <article key={p.id} className="cx-card cx-stack" style={{ gap: 6, opacity: p.status === 'cancelled' ? 0.55 : 1 }}>
                    <div className="cx-row between">
                      <b>{p.type}</b>
                      <span className={`cx-pill ${p.status === 'done' ? 'ready' : p.status === 'cancelled' ? 'cancelled' : 'received'}`}>{p.status}</span>
                    </div>
                    <p className="cx-small">
                      {dayLabel(p.date, today)} {spokenTime(p.time)} · {p.guests} guests · {p.location}
                    </p>
                    {p.name && (
                      <p className="cx-small">
                        <b>{p.name}</b>
                        {p.phone && (
                          <>
                            {' · '}
                            <a className="cx-link" href={`tel:${p.phone.replace(/\s/g, '')}`}>
                              {p.phone}
                            </a>
                          </>
                        )}
                        {p.email && (
                          <>
                            {' · '}
                            <a className="cx-link" href={`mailto:${p.email}`} style={{ color: '#c99355' }}>
                              ✉️ {p.email}
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    <p className="cx-small cx-muted cx-mono">
                      {p.code}
                      {p.source === 'voice' ? ' · AI call' : ''}
                    </p>
                    {canAct && p.status === 'confirmed' && (
                      <div className="cx-row" style={{ gap: 6 }}>
                        <button type="button" className="cx-btn sm primary" onClick={() => setStatus('party', p.id, 'done')}>
                          Mark done
                        </button>
                        <button type="button" className="cx-btn sm" onClick={() => window.confirm('Cancel this party?') && setStatus('party', p.id, 'cancelled')}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="cx-empty">No party bookings yet.</p>
            ))}

          {tab === 'calls' &&
            data.canSeeCalls &&
            (calls.length ? (
              <section className="cx-stack" style={{ gap: 10 }}>
                {calls.map((c) => (
                  <CallCard key={c.id} c={c} now={now} open={open.has(c.id)} onToggle={() => toggle(c.id)} />
                ))}
              </section>
            ) : (
              <p className="cx-empty">No AI calls yet. When a guest taps Call Concierge on the website, the call shows here live, word by word.</p>
            ))}
        </>
      )}
    </>
  );
}
