'use client';

import { useEffect, useMemo, useState } from 'react';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { api, pkDate, pkTime } from './api';
import { useRun } from './Toasts';

type Entry = { t: number; uid: string; name: string; role: string; action: string; detail: string };

/** The activity log: sign-ins, orders taken, payments, cancellations, menu and team changes. */
export function ActivityScreen() {
  const run = useRun();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  useEffect(() => {
    run(() => api<{ entries: Entry[] }>('/api/staff/audit')).then((r) => r && setEntries(r.entries));
  }, [run]);
  const people = useMemo(() => [...new Map((entries || []).filter((e) => e.uid).map((e) => [e.uid, e.name])).entries()], [entries]);
  const list = (entries || []).filter((e) => (!who || e.uid === who) && (!q.trim() || `${e.action} ${e.detail} ${e.name}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> The last 1,000 changes
          </p>
          <h1 className="cx-h1">Activity</h1>
        </div>
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
                <li key={i} style={{ gridTemplateColumns: '52px minmax(0,1fr)' }}>
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
