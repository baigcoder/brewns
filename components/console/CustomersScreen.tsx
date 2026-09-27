'use client';

import { useEffect, useMemo, useState } from 'react';
import { ago, api, rs, useNow } from './api';
import { useRun } from './Toasts';

type Row = { key: string; name: string; phone: string; email: string; orders: number; spend: number; last: number; favourite: string; account: boolean; since: number; club: { stamps: number; rewards: number; lifetime: number } | null };
const PAGE = 40;

/** The list as a spreadsheet, for a mailing or a loyalty push. */
function downloadCsv(rows: Row[]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Name', 'Mobile', 'Email', 'Orders', 'Spent (Rs)', 'Usually has', 'Last order', 'Account', 'Club stamps', 'Free drinks'].map(cell).join(','),
    ...rows.map((c) => [c.name, c.phone, c.email, c.orders, Math.round(c.spend), c.favourite, c.last ? new Date(c.last).toISOString().slice(0, 10) : '', c.account ? 'yes' : 'no', c.club?.stamps ?? '', c.club?.rewards ?? ''].map(cell).join(',')),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `brewns-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Data = { customers: Row[]; totals: { customers: number; accounts: number; members: number; repeat: number } };

/** Who buys: the last 30 days by mobile number, with accounts and club cards. */
export function CustomersScreen() {
  const run = useRun();
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'accounts' | 'members'>('all');
  const [sort, setSort] = useState<'spend' | 'orders' | 'recent'>('spend');
  // how many rows are showing, for the current search: a new search starts at one page again
  const [more, setMore] = useState({ key: '', n: PAGE });
  useEffect(() => {
    run(() => api<Data>('/api/staff/customers')).then((r) => r && setData(r));
  }, [run]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const by = { spend: (c: Row) => c.spend, orders: (c: Row) => c.orders, recent: (c: Row) => c.last }[sort];
    return (data?.customers || [])
      .filter((c) => (only === 'all' || (only === 'accounts' ? c.account : !!c.club)) && (!s || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(s)))
      .sort((a, b) => by(b) - by(a));
  }, [data, q, only, sort]);
  const listKey = `${q}|${only}|${sort}`;
  const shown = more.key === listKey ? more.n : PAGE;
  const now = useNow(60000);
  const t = data?.totals;
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> Last 30 days, and every account
          </p>
          <h1 className="cx-h1">Customers</h1>
        </div>
      </div>
      {t && (
        <div className="cx-kpis" style={{ marginBottom: 16 }}>
          <div className="cx-kpi">
            <span className="cx-eyebrow">Customers</span>
            <span className="cx-kpi-v">{t.customers}</span>
          </div>
          <div className="cx-kpi">
            <span className="cx-eyebrow">Came back</span>
            <span className="cx-kpi-v">{t.customers ? Math.round((t.repeat / t.customers) * 100) : 0}%</span>
            <span className="cx-kpi-d">{t.repeat} ordered more than once</span>
          </div>
          <div className="cx-kpi">
            <span className="cx-eyebrow">Accounts</span>
            <span className="cx-kpi-v">{t.accounts}</span>
          </div>
          <div className="cx-kpi">
            <span className="cx-eyebrow">Club members</span>
            <span className="cx-kpi-v">{t.members}</span>
            <span className="cx-kpi-d">with an account card</span>
          </div>
        </div>
      )}
      <div className="cx-row" style={{ marginBottom: 12 }}>
        <input className="cx-input" style={{ maxWidth: 280 }} placeholder="Search name, mobile, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="cx-seg" role="group" aria-label="Show">
          {(['all', 'accounts', 'members'] as const).map((o) => (
            <button type="button" key={o} aria-pressed={only === o} onClick={() => setOnly(o)}>
              {o === 'all' ? 'Everyone' : o === 'accounts' ? 'With an account' : 'Club members'}
            </button>
          ))}
        </div>
        <select className="cx-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort by">
          <option value="spend">Top spenders</option>
          <option value="orders">Most orders</option>
          <option value="recent">Most recent</option>
        </select>
        {!!list.length && (
          <button type="button" className="cx-btn sm" onClick={() => downloadCsv(list)}>
            Export CSV
          </button>
        )}
      </div>
      {!data ? (
        <p className="cx-empty">Loading…</p>
      ) : !list.length ? (
        <p className="cx-empty">
          <b>No customers yet</b>They appear here after their first order.
        </p>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Mobile</th>
                <th className="r">Orders</th>
                <th className="r">Spent</th>
                <th>Usually has</th>
                <th>Last order</th>
                <th>Club</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, shown).map((c) => (
                <tr key={c.key}>
                  <td>
                    <p style={{ fontWeight: 600 }}>{c.name}</p>
                    {c.account && <p className="cx-small cx-muted">{c.email} · account</p>}
                  </td>
                  <td className="cx-mono cx-small">{c.phone}</td>
                  <td className="r cx-num">{c.orders}</td>
                  <td className="r cx-num">{rs(c.spend)}</td>
                  <td className="cx-muted">{c.favourite ? c.favourite.charAt(0) + c.favourite.slice(1).toLowerCase() : '—'}</td>
                  <td className="cx-small cx-muted">{c.last ? ago(c.last, now) : '—'}</td>
                  <td className="cx-small">{c.club ? `${c.club.stamps}/10 · ${c.club.rewards} free` : <span className="cx-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > shown && (
            <div className="cx-row between" style={{ padding: '12px 14px', borderTop: '1px solid var(--cx-line)' }}>
              <span className="cx-small cx-muted">
                Showing {shown} of {list.length}
              </span>
              <button type="button" className="cx-btn sm" onClick={() => setMore({ key: listKey, n: shown + PAGE })}>
                Show {Math.min(PAGE, list.length - shown)} more
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
