'use client';

import { useEffect, useState } from 'react';
import { monthLabel, monthOf, PAY_KINDS, PAY_METHODS, shiftMonth, type PayKind } from '@/lib/payroll';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import type { PayRow } from '@/lib/server/payroll';
import { api, initials, rs } from './api';
import { useRun } from './Toasts';

const signed = (k: PayKind, n: number) => `${PAY_KINDS[k].sign > 0 ? '+' : '−'} ${rs(n)}`;

/** A face: their photo, else their initials. */
export function Face({ name, photo, size = 34 }: { name: string; photo?: string; size?: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary or our own small photo route
    <img src={photo} alt="" width={size} height={size} className="cx-avatar" style={{ width: size, height: size, objectFit: 'cover', padding: 0 }} />
  ) : (
    <span className="cx-avatar" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}

/** The owner's payroll: each person's salary, this month's bonuses and deductions, and paying them. */
export function PayrollScreen() {
  const run = useRun();
  const [month, setMonth] = useState(() => monthOf(Date.now()));
  const [rows, setRows] = useState<PayRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api<{ rows: PayRow[] }>(`/api/staff/payroll?month=${month}`)
      .then((r) => live && setRows(r.rows))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [month]);

  const act = async (body: Record<string, unknown>, done: string) => {
    const r = await run(() => api<{ rows: PayRow[] }>('/api/staff/payroll', { ...body, month }), done);
    if (r) setRows(r.rows);
    return !!r;
  };

  const list = rows || [];
  const total = list.reduce((s, r) => s + (r.month.paid?.net ?? r.totals.net), 0);
  const paid = list.reduce((s, r) => s + (r.month.paid?.net ?? 0), 0);
  const noSalary = list.filter((r) => !r.plan).length;

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {list.length} on the team · only owners see this page
          </p>
          <h1 className="cx-h1">Payroll</h1>
        </div>
        <div className="cx-row">
          <button type="button" className="cx-btn sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <b style={{ minWidth: 140, textAlign: 'center' }}>{monthLabel(month)}</b>
          <button type="button" className="cx-btn sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
      </div>

      <div className="cx-kpis" style={{ marginBottom: 16 }}>
        <div className="cx-kpi">
          <span className="cx-eyebrow">Payroll this month</span>
          <span className="cx-kpi-v">{rs(total)}</span>
          <span className="cx-kpi-d">Salaries, plus bonuses, minus deductions</span>
        </div>
        <div className="cx-kpi">
          <span className="cx-eyebrow">Paid</span>
          <span className="cx-kpi-v">{rs(paid)}</span>
          <span className="cx-kpi-d">{list.filter((r) => r.month.paid).length} of {list.length} people</span>
        </div>
        <div className="cx-kpi">
          <span className="cx-eyebrow">Still to pay</span>
          <span className="cx-kpi-v">{rs(total - paid)}</span>
          <span className={`cx-kpi-d${noSalary ? ' down' : ''}`}>{noSalary ? `${noSalary} without a salary set` : 'Everyone has a salary set'}</span>
        </div>
      </div>

      {!rows ? (
        <p className="cx-empty">Loading…</p>
      ) : !list.length ? (
        <p className="cx-empty">Nobody has joined the team yet. Invite people from the Team page.</p>
      ) : (
        <div className="cx-stack">
          {list.map((r) => (
            <PayCard key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} act={act} />
          ))}
        </div>
      )}
    </>
  );
}

function PayCard({ r, open, onToggle, act }: { r: PayRow; open: boolean; onToggle: () => void; act: (b: Record<string, unknown>, done: string) => Promise<boolean> }) {
  const [salary, setSalary] = useState(String(r.plan?.salary ?? ''));
  const [payDay, setPayDay] = useState(String(r.plan?.payDay ?? 1));
  const [item, setItem] = useState<{ kind: PayKind; amount: string; note: string }>({ kind: 'bonus', amount: '', note: '' });
  const [pay, setPay] = useState<{ method: string; ref: string }>({ method: PAY_METHODS[0], ref: '' });
  const p = r.month.paid;
  const t = r.totals;
  const planChanged = salary !== String(r.plan?.salary ?? '') || payDay !== String(r.plan?.payDay ?? 1);

  return (
    <article className="cx-card cx-stack" style={{ gap: 12 }}>
      <div className="cx-row between" style={{ flexWrap: 'wrap' }}>
        <div className="cx-row" style={{ flexWrap: 'nowrap' }}>
          <Face name={r.name} photo={r.photo} size={40} />
          <div>
            <p style={{ fontWeight: 600 }}>
              {r.name}
              {!r.active && <span className="cx-muted"> · switched off</span>}
            </p>
            <p className="cx-small cx-muted">{ROLE_INFO[r.role as Role]?.label || r.role}</p>
          </div>
        </div>
        <div className="cx-row" style={{ gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <p className="cx-mono" style={{ fontSize: 20, fontWeight: 700 }}>
              {rs(p?.net ?? t.net)}
            </p>
            <p className="cx-small cx-muted">
              {rs(t.base)}
              {t.add ? ` + ${rs(t.add)}` : ''}
              {t.less ? ` − ${rs(t.less)}` : ''}
            </p>
          </div>
          <span className={`cx-pill${p ? ' ready' : r.plan ? ' received' : ' cancelled'}`}>{p ? 'Paid' : r.plan ? `Due day ${r.plan.payDay}` : 'No salary set'}</span>
          <button type="button" className="cx-btn sm" aria-expanded={open} onClick={onToggle}>
            {open ? 'Close' : 'Open'}
          </button>
        </div>
      </div>

      {open && (
        <div className="cx-stack" style={{ gap: 14 }}>
          <div className="cx-divider" />
          <div className="cx-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="cx-field" style={{ minWidth: 160 }}>
              <span>Monthly salary (Rs)</span>
              <input inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value.replace(/\D/g, ''))} placeholder="45000" />
            </label>
            <label className="cx-field" style={{ width: 120 }}>
              <span>Pay day</span>
              <select value={payDay} onChange={(e) => setPayDay(e.target.value)}>
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="cx-btn" disabled={!salary || !planChanged} onClick={() => act({ action: 'plan', userId: r.id, salary: Number(salary), payDay: Number(payDay) }, `${r.name}'s salary saved.`)}>
              Save salary
            </button>
          </div>
          {p && <p className="cx-small cx-muted">This month is paid, so it stays at {rs(p.base)}. A new salary counts from the next unpaid month.</p>}

          <div className="cx-stack" style={{ gap: 6 }}>
            <p className="cx-eyebrow">This month</p>
            <div className="cx-row between">
              <span>Salary</span>
              <span className="cx-mono">{rs(t.base)}</span>
            </div>
            {r.month.items.map((i) => (
              <div key={i.id} className="cx-row between">
                <span>
                  {PAY_KINDS[i.kind].label}
                  {i.note && <span className="cx-muted"> · {i.note}</span>}
                </span>
                <span className="cx-row" style={{ gap: 8 }}>
                  <span className="cx-mono" style={{ color: PAY_KINDS[i.kind].sign > 0 ? '#7fd6ac' : '#f19c9c' }}>
                    {signed(i.kind, i.amount)}
                  </span>
                  {!p && (
                    <button type="button" className="cx-btn sm" aria-label={`Remove ${PAY_KINDS[i.kind].label}`} onClick={() => act({ action: 'unitem', userId: r.id, itemId: i.id }, 'Removed.')}>
                      ×
                    </button>
                  )}
                </span>
              </div>
            ))}
            <div className="cx-row between" style={{ borderTop: '1px solid var(--cx-line)', paddingTop: 6, fontWeight: 700 }}>
              <span>To pay</span>
              <span className="cx-mono">{rs(p?.net ?? t.net)}</span>
            </div>
          </div>

          {!p && (
            <form
              className="cx-row"
              style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ action: 'item', userId: r.id, kind: item.kind, amount: Number(item.amount), note: item.note }, `${PAY_KINDS[item.kind].label} added.`)) setItem({ ...item, amount: '', note: '' });
              }}
            >
              <label className="cx-field" style={{ width: 150 }}>
                <span>Add</span>
                <select value={item.kind} onChange={(e) => setItem({ ...item, kind: e.target.value as PayKind })}>
                  {(Object.keys(PAY_KINDS) as PayKind[]).map((k) => (
                    <option key={k} value={k}>
                      {PAY_KINDS[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cx-field" style={{ width: 130 }}>
                <span>Amount (Rs)</span>
                <input inputMode="numeric" value={item.amount} onChange={(e) => setItem({ ...item, amount: e.target.value.replace(/\D/g, '') })} />
              </label>
              <label className="cx-field" style={{ flex: 1, minWidth: 180 }}>
                <span>{PAY_KINDS[item.kind].sign < 0 ? 'Why (they see this)' : 'Note · optional'}</span>
                <input value={item.note} maxLength={80} onChange={(e) => setItem({ ...item, note: e.target.value })} placeholder={item.kind === 'bonus' ? 'Best month at the bar' : item.kind === 'overtime' ? '6 extra hours' : item.kind === 'advance' ? 'Advance on 12 Oct' : 'Two late days'} />
              </label>
              <button className="cx-btn" disabled={!item.amount}>
                Add
              </button>
            </form>
          )}

          <div className="cx-divider" />
          {p ? (
            <div className="cx-row between" style={{ flexWrap: 'wrap' }}>
              <p className="cx-small">
                Paid {rs(p.net)} on {new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} by {p.method.toLowerCase()}
                {p.ref ? ` · ${p.ref}` : ''} · {p.by}
              </p>
              <button type="button" className="cx-btn sm" onClick={() => window.confirm(`Mark ${r.name}'s pay for this month as not paid? Use this only to correct a mistake.`) && act({ action: 'unpaid', userId: r.id }, 'Marked not paid.')}>
                Mark not paid
              </button>
            </div>
          ) : (
            <div className="cx-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="cx-field" style={{ width: 190 }}>
                <span>Paid by</span>
                <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  {PAY_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="cx-field" style={{ flex: 1, minWidth: 160 }}>
                <span>Reference · optional</span>
                <input value={pay.ref} maxLength={40} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder="Bank or wallet transaction ID" />
              </label>
              <button
                type="button"
                className="cx-btn primary"
                disabled={!r.plan && !t.add}
                onClick={() => window.confirm(`Pay ${r.name} ${rs(t.net)}? They get an email with the breakdown.`) && act({ action: 'paid', userId: r.id, ...pay }, `${r.name} is paid. They've been emailed the breakdown.`)}
              >
                Mark paid · {rs(t.net)}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
