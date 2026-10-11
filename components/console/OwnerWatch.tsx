'use client';

import { useEffect, useState } from 'react';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { varianceLabel, type TillClose } from '@/lib/till';
import { ago, api, rs, useNow } from './api';
import { useRun } from './Toasts';

export type Exception = { name: string; role: string; cancels: number; cancelValue: number; refunds: number; refundValue: number };

/** Orders cancelled and money refunded, by the person who did it: the first place to look when a drawer does not add up. */
export function ExceptionsCard({ rows }: { rows: Exception[] }) {
  if (!rows.length) return null;
  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Voids and refunds by person</p>
          <p className="cx-small cx-muted">Orders a person cancelled and money they refunded in this period. Customers cancelling their own order are not counted. One person far above the rest is worth a conversation.</p>
        </div>
      </div>
      <div className="cx-table-wrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th>Person</th>
              <th className="r">Cancelled</th>
              <th className="r">Worth</th>
              <th className="r">Refunds</th>
              <th className="r">Worth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.name}>
                <td>
                  <b>{x.name}</b> <span className="cx-muted cx-small">{ROLE_INFO[x.role as Role]?.label || ''}</span>
                </td>
                <td className="r cx-num">{x.cancels}</td>
                <td className="r cx-num">{rs(x.cancelValue)}</td>
                <td className="r cx-num">{x.refunds}</td>
                <td className="r cx-num">{rs(x.refundValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Each time a cashier counted the drawer: what they counted, what it should have held, and the difference. */
export function CashDrawerCard() {
  const run = useRun();
  const now = useNow(60000);
  const [closes, setCloses] = useState<TillClose[] | null>(null);
  useEffect(() => {
    run(() => api<{ closes: TillClose[] }>('/api/staff/till/closes')).then((r) => r && setCloses(r.closes));
  }, [run]);
  if (!closes) return null;
  const short = closes.filter((c) => c.variance < 0).reduce((s, c) => s + c.variance, 0);
  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Cash drawers</p>
          <p className="cx-small cx-muted">When a cashier closes their till they count the cash; the console works out what it should hold from the payments it recorded.</p>
        </div>
        {closes.length > 0 && <span className="cx-small cx-muted">Last {closes.length}: {short < 0 ? `Rs ${(-short).toLocaleString('en-US')} short in total` : 'nothing short'}</span>}
      </div>
      {!closes.length ? (
        <p className="cx-empty">No till has been closed yet. A cashier closes theirs from New order → Drawer and bills.</p>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Cashier</th>
                <th className="r">Orders</th>
                <th className="r">Expected</th>
                <th className="r">Counted</th>
                <th className="r">Difference</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {closes.slice(0, 15).map((c) => (
                <tr key={`${c.uid}-${c.t}`}>
                  <td className="cx-muted cx-small">{ago(c.t, now)}</td>
                  <td>{c.name}</td>
                  <td className="r cx-num">{c.orders}</td>
                  <td className="r cx-num">{rs(c.expected)}</td>
                  <td className="r cx-num">{rs(c.counted)}</td>
                  <td className="r cx-num" style={{ color: c.variance < 0 ? 'var(--cx-late)' : c.variance > 0 ? 'var(--cx-accent)' : 'var(--cx-ready)', fontWeight: 600 }}>
                    {varianceLabel(c.variance)}
                  </td>
                  <td className="cx-muted cx-small">{c.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
