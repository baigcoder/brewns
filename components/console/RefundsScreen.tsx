'use client';

import { useCallback, useEffect, useState } from 'react';
import { LOC_TITLES, PAY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { ago, api, pkDate, pkTime, rs } from './api';
import { useLive } from './Live';
import { useRun } from './Toasts';

type Row = {
  number: number;
  loc: number;
  name: string;
  phone: string;
  total: number;
  amount: number;
  state: 'pending' | 'paid';
  reason: string;
  at: number;
  by: string;
  method: number;
  ref?: string;
  paidAt?: number;
  paidBy?: string;
  payRef: string;
};
type Data = { pending: Row[]; paid: Row[]; owed: number };

const OVERDUE = 24 * 3600000;

/** Money the café owes customers for paid orders that were cancelled (or came up short), and what has been sent back. */
export function RefundsScreen() {
  const run = useRun();
  const { data: live, act } = useLive();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(0);
  const load = useCallback(() => run(() => api<Data>('/api/staff/refunds')).then((r) => r && setData(r)), [run]);
  // Reload whenever the café's live version moves (a refund opened or sent anywhere).
  useEffect(() => {
    load();
  }, [load, live?.v]);

  const send = async (r: Row) => {
    const cash = r.method === 0;
    const ref = window.prompt(cash ? `Handed ${rs(r.amount)} back in cash? Leave blank to confirm.` : `Enter the transaction ID of the ${rs(r.amount)} you sent to ${r.name}.`, '');
    if (ref === null) return;
    setBusy(r.number);
    await run(() => act(r.number, { type: 'refundpaid', ref }).then(load), `Refund to ${r.name} recorded. They have been told.`);
    setBusy(0);
  };

  const now = live?.now || 0;
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {data ? (data.pending.length ? `${rs(data.owed)} owed to ${data.pending.length} customer${data.pending.length > 1 ? 's' : ''}` : 'Nobody is owed anything') : 'Loading'}
          </p>
          <h1 className="cx-h1">Refunds</h1>
        </div>
      </div>

      <section className="cx-card" style={{ marginBottom: 20 }}>
        <div className="cx-card-h">
          <p className="cx-h2">To send</p>
        </div>
        {!data ? (
          <p className="cx-empty">Loading…</p>
        ) : !data.pending.length ? (
          <p className="cx-empty">All refunds are sent. When a paid order is cancelled it appears here.</p>
        ) : (
          <div className="cx-stack" style={{ gap: 12 }}>
            {data.pending.map((r) => {
              const late = now > 0 && now - r.at > OVERDUE;
              return (
                <div key={r.number} className="cx-row between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--cx-line)' }}>
                  <div className="cx-stack" style={{ gap: 3 }}>
                    <p style={{ fontWeight: 600 }}>
                      {orderNo(r.number)} · {rs(r.amount)}
                      {r.amount < r.total && <span className="cx-muted"> of {rs(r.total)}</span>}
                      {late && <span style={{ color: 'var(--cx-late)' }}> · overdue</span>}
                    </p>
                    <p className="cx-small">
                      {r.name} · <a className="cx-link" href={`tel:${r.phone.replace(/\s/g, '')}`}>{r.phone}</a> · {LOC_TITLES[r.loc]?.split(',')[0]}
                    </p>
                    <p className="cx-small cx-muted">
                      Paid by {PAY[r.method][0].toLowerCase()}
                      {r.payRef ? <> · their transaction ID <span className="cx-mono">{r.payRef}</span></> : ''} · {r.reason} · {now ? ago(r.at, now) : pkTime(r.at)}
                    </p>
                  </div>
                  <button type="button" className="cx-btn go" disabled={busy === r.number} onClick={() => send(r)}>
                    {r.method === 0 ? 'Handed back' : 'Sent it'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="cx-card">
        <div className="cx-card-h">
          <p className="cx-h2">Sent</p>
        </div>
        {!data ? null : !data.paid.length ? (
          <p className="cx-empty">Nothing sent yet.</p>
        ) : (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="r">Amount</th>
                  <th>Reference</th>
                  <th>Sent</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {data.paid.map((r) => (
                  <tr key={r.number}>
                    <td className="cx-mono">{orderNo(r.number)}</td>
                    <td>{r.name}</td>
                    <td className="r cx-num">{rs(r.amount)}</td>
                    <td className="cx-mono">{r.ref || '—'}</td>
                    <td className="cx-muted cx-small">{r.paidAt ? `${pkDate(r.paidAt)} ${pkTime(r.paidAt)}` : ''}</td>
                    <td className="cx-muted">{r.paidBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
