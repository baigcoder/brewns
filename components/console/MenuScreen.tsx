'use client';

import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from '@/lib/catalog';
import { api, pkDate } from './api';
import { useLive } from './Live';
import { useMe } from './Shell';
import { useRun } from './Toasts';

const GROUPS: [string, string][] = [
  ['drinks', 'Coffee and tea'],
  ['coolers', 'Coolers'],
  ['bakery', 'Bakery'],
  ['kitchen', 'Kitchen'],
  ['beans', 'Beans'],
  ['merch', 'Merch'],
  ['gifts', 'Gift cards'],
];

type Promo = { code: string; pct: number; active: boolean; uses: number; createdAt: number; note?: string };

export function MenuScreen() {
  const { can } = useMe();
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> What customers can order right now
          </p>
          <h1 className="cx-h1">Menu</h1>
        </div>
      </div>
      <div className="cx-stack" style={{ gap: 20 }}>
        {can('menu.availability') && <SoldOut />}
        {can('menu.promos') && <Promos />}
      </div>
    </>
  );
}

function SoldOut() {
  const { data, refresh } = useLive();
  const run = useRun();
  const [q, setQ] = useState('');
  const out = new Set(data?.soldOut || []);
  const [pending, setPending] = useState<string>('');
  const list = useMemo(() => CATALOG.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const toggle = async (id: string, name: string) => {
    setPending(id);
    await run(() => api('/api/staff/menu', { id, out: !out.has(id) }).then(refresh), out.has(id) ? `${name} is back on the menu.` : `${name} is sold out on the site and the counter.`);
    setPending('');
  };
  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Sold out</p>
          <p className="cx-small cx-muted">Switch an item off and the site stops selling it within seconds, at every shop. {out.size ? `${out.size} off now.` : ''}</p>
        </div>
        <input className="cx-input" style={{ maxWidth: 220 }} placeholder="Find an item" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="cx-grid three">
        {GROUPS.map(([cat, label]) => {
          const items = list.filter((p) => p.cat === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="cx-stack" style={{ alignContent: 'start' }}>
              <p className="cx-eyebrow">{label}</p>
              {items.map((p) => (
                <div key={p.id} className="cx-row between" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ opacity: out.has(p.id) ? 0.55 : 1 }}>
                    {p.name.charAt(0) + p.name.slice(1).toLowerCase()}
                    {out.has(p.id) && <span className="cx-small" style={{ color: 'var(--cx-late)' }}> · sold out</span>}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    className="cx-switch"
                    aria-checked={!out.has(p.id)}
                    aria-label={`${p.name} on the menu`}
                    disabled={pending === p.id}
                    onClick={() => toggle(p.id, p.name.charAt(0) + p.name.slice(1).toLowerCase())}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Promos() {
  const run = useRun();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [form, setForm] = useState({ code: '', pct: 10, note: '' });
  useEffect(() => {
    run(() => api<{ promos: Promo[] }>('/api/staff/promos')).then((r) => r && setPromos(r.promos));
  }, [run]);
  const post = async (body: Record<string, unknown>, done?: string) => {
    const r = await run(() => api<{ promos: Promo[] }>('/api/staff/promos', body), done);
    if (r) setPromos(r.promos);
    return !!r;
  };
  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Promo codes</p>
          <p className="cx-small cx-muted">A percentage off the bill (after a club free drink). The checkout suggests the first active code.</p>
        </div>
      </div>
      <form
        className="cx-row"
        style={{ marginBottom: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await post({ action: 'create', ...form, code: form.code.toUpperCase() }, `${form.code.toUpperCase()} is live.`)) setForm({ code: '', pct: 10, note: '' });
        }}
      >
        <input className="cx-input" style={{ maxWidth: 170, textTransform: 'uppercase' }} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z0-9]/gi, '') })} aria-label="Code" maxLength={24} />
        <label className="cx-row cx-small">
          <input className="cx-input" style={{ width: 80 }} type="number" min={1} max={50} value={form.pct} onChange={(e) => setForm({ ...form, pct: +e.target.value })} aria-label="Percent off" />% off
        </label>
        <input className="cx-input" style={{ maxWidth: 260 }} placeholder="Note (who it's for)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={80} />
        <button className="cx-btn primary" disabled={form.code.length < 3}>
          Create code
        </button>
      </form>
      {!promos ? (
        <p className="cx-muted">Loading…</p>
      ) : !promos.length ? (
        <p className="cx-empty">No codes yet.</p>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Off</th>
                <th>Note</th>
                <th className="r">Used</th>
                <th>Since</th>
                <th>On</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.code}>
                  <td className="cx-mono">{p.code}</td>
                  <td>{p.pct}%</td>
                  <td className="cx-muted">{p.note || '—'}</td>
                  <td className="r cx-num">{p.uses}</td>
                  <td className="cx-muted cx-small">{p.createdAt ? pkDate(p.createdAt) : 'From the start'}</td>
                  <td>
                    <button type="button" role="switch" className="cx-switch" aria-checked={p.active} aria-label={`${p.code} active`} onClick={() => post({ action: 'toggle', code: p.code })} />
                  </td>
                  <td className="r">
                    <button type="button" className="cx-btn sm danger" onClick={() => window.confirm(`Delete ${p.code}? Orders that used it keep their discount.`) && post({ action: 'delete', code: p.code }, `${p.code} deleted.`)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
