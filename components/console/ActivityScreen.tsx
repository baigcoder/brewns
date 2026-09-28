'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { ago, api, pkDate, pkTime, useNow } from './api';

type Entry = { t: number; uid: string; name: string; role: string; action: string; detail: string };

/** The activity log: sign-ins, orders taken, payments, cancellations, menu and team changes. */
export function ActivityScreen() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const versionRef = useRef<number | null>(null);
  const inFlight = useRef(false);
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const now = useNow(15000);
  const refresh = useCallback(async () => {
    if (document.hidden || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const query = versionRef.current === null ? '' : `?v=${versionRef.current}`;
      const result = await api<{ version: number; same?: boolean; entries?: Entry[] }>(`/api/staff/audit${query}`);
      if (!result.same) setEntries(result.entries || []);
      versionRef.current = result.version;
      setVersion(result.version);
      setUpdatedAt(Date.now());
      setError('');
    } catch (cause) {
      setError((cause as Error).message || 'Could not refresh activity.');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    let timer = 0;
    let disposed = false;
    const schedule = () => {
      if (disposed) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (!disposed && !document.hidden) await refresh();
        if (!disposed) schedule();
      }, document.hidden ? 20000 : 4000);
    };
    const initial = window.setTimeout(() => {
      void refresh().finally(schedule);
    }, 0);
    const wake = () => {
      if (!document.hidden) {
        void refresh();
        schedule();
      } else schedule();
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      disposed = true;
      window.clearTimeout(initial);
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [refresh]);
  const people = useMemo(() => [...new Map((entries || []).filter((e) => e.uid).map((e) => [e.uid, e.name])).entries()], [entries]);
  const list = (entries || []).filter((e) => (!who || e.uid === who) && (!q.trim() || `${e.action} ${e.detail} ${e.name}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> The last 1,000 changes · Live sync
          </p>
          <h1 className="cx-h1">Activity</h1>
        </div>
        <div className="cx-row" style={{ gap: 12 }}>
          <span className="cx-small cx-muted" aria-live="polite">
            {refreshing && !entries ? 'Connecting…' : error ? 'Sync paused' : `Updated ${updatedAt ? ago(updatedAt, now) : '—'}`}
            {version !== null && !error ? ` · v${version}` : ''}
          </span>
          <button type="button" className="cx-btn sm" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <p className="cx-banner" role="status">{error} · Retrying automatically.</p>}
      <div className="cx-row" style={{ marginBottom: 12 }}>
        <input className="cx-input" style={{ maxWidth: 280 }} placeholder="Search: cancelled, sold out, #1024…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="cx-select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
          <option value="">Everyone</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {!entries ? (
        <p className="cx-empty">Loading…</p>
      ) : !list.length ? (
        <p className="cx-empty">Nothing yet.</p>
      ) : (
        <div className="cx-card">
          <ol className="cx-timeline" style={{ gap: 10 }}>
            {list.map((e, i) => {
              const day = pkDate(e.t);
              const head = i === 0 || pkDate(list[i - 1].t) !== day;
              return (
                <li key={`${e.t}:${e.uid}:${e.action}:${i}`} style={{ gridTemplateColumns: '52px minmax(0,1fr)' }}>
                  <time>
                    {head ? (
                      <>
                        {day}
                        <br />
                      </>
                    ) : null}
                    {pkTime(e.t)}
                  </time>
                  <span>
                    <b style={{ color: 'var(--cx-text)' }}>{e.name}</b>
                    {e.role && ROLE_INFO[e.role as Role] ? <span className="cx-faint"> · {ROLE_INFO[e.role as Role].label}</span> : null} — {e.action}
                    {e.detail ? <span className="cx-faint"> · {e.detail}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </>
  );
}
