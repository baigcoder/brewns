'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIT_CATEGORIES, auditCategory, auditCsv, type AuditCategory } from '@/lib/auditKinds';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { ago, api, pkDate, pkTime, useNow } from './api';

type Entry = { t: number; uid: string; name: string; role: string; action: string; detail: string; kind?: 'security' };

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
  const [cat, setCat] = useState<AuditCategory | ''>('');
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
  const matches = (e: Entry) => (!who || e.uid === who) && (!q.trim() || `${e.action} ${e.detail} ${e.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries || []) c[auditCategory(e)] = (c[auditCategory(e)] || 0) + 1;
    return c;
  }, [entries]);
  const list = (entries || []).filter((e) => matches(e) && (!cat || auditCategory(e) === cat));
  const download = () => {
    const url = URL.createObjectURL(new Blob([`\uFEFF${auditCsv(list)}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `brewns-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> The last 1,000 changes and 500 security events · Live sync
          </p>
          <h1 className="cx-h1">Activity</h1>
        </div>
        <div className="cx-row" style={{ gap: 12 }}>
          <span className="cx-small cx-muted" aria-live="polite">
            {refreshing && !entries ? 'Connecting…' : error ? 'Sync paused' : `Updated ${updatedAt ? ago(updatedAt, now) : '—'}`}
            {version !== null && !error ? ` · v${version}` : ''}
          </span>
          <button type="button" className="cx-btn sm" onClick={download} disabled={!list.length} title="Download what is shown below as a spreadsheet">
            Export CSV
          </button>
          <button type="button" className="cx-btn sm" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && <p className="cx-banner" role="status">{error} · Retrying automatically.</p>}
      <div className="cx-row" style={{ marginBottom: 10 }} role="group" aria-label="Show">
        <button type="button" className={`cx-btn sm${cat === '' ? ' primary' : ''}`} aria-pressed={cat === ''} onClick={() => setCat('')}>
          Everything
        </button>
        {AUDIT_CATEGORIES.map((c) => (
          <button key={c.key} type="button" className={`cx-btn sm${cat === c.key ? ' primary' : ''}`} aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>
            {c.label}
            {counts[c.key] ? ` · ${counts[c.key]}` : ''}
          </button>
        ))}
      </div>
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
                    {e.kind === 'security' && <i className="cx-sec-dot" title="Security event" aria-label="Security event" />}
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
