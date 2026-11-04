'use client';

import { useEffect, useMemo, useState } from 'react';
import { CATALOG } from '@/lib/catalog';
import { productImage } from '@/lib/products';
import { promoRulesLabel } from '@/lib/promos';
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

type Promo = { code: string; pct: number; active: boolean; hint?: boolean; uses: number; createdAt: number; note?: string; maxUses?: number; expires?: string; minTotal?: number; oncePerCustomer?: boolean };

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
        {can('menu.photos') && <Photos />}
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
  const stock = data?.stock || {};
  const [pending, setPending] = useState<string>('');
  const list = useMemo(() => CATALOG.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const toggle = async (id: string, name: string) => {
    setPending(id);
    await run(() => api('/api/staff/menu', { id, out: !out.has(id) }).then(refresh), out.has(id) ? `${name} is back on the menu.` : `${name} is sold out on the site and the counter.`);
    setPending('');
  };
  const setCount = async (id: string, name: string, value: string) => {
    const count = value.trim() === '' ? null : Number(value);
    if (count === (stock[id] ?? null)) return;
    setPending(id);
    await run(() => api('/api/staff/menu', { id, stock: count }).then(refresh), count === null ? `${name} is no longer counted.` : `${name}: ${count} left.`);
    setPending('');
  };
  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Sold out and stock</p>
          <p className="cx-small cx-muted">Switch an item off and the site stops selling it within seconds, at every shop. Type a count to track what is left: it sells out by itself at zero, and a cancelled order puts it back. {out.size ? `${out.size} off now.` : ''}</p>
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
                    {stock[p.id] !== undefined && stock[p.id] > 0 && stock[p.id] <= 5 && <span className="cx-small" style={{ color: 'var(--cx-late)' }}> · low</span>}
                  </span>
                  <input
                    key={`${p.id}:${stock[p.id] ?? ''}`}
                    className="cx-input"
                    style={{ width: 64, marginLeft: 'auto' }}
                    type="number"
                    min={0}
                    max={9999}
                    placeholder="∞"
                    aria-label={`${p.name} in stock`}
                    defaultValue={stock[p.id] ?? ''}
                    disabled={pending === p.id}
                    onBlur={(e) => setCount(p.id, p.name.charAt(0) + p.name.slice(1).toLowerCase(), e.target.value)}
                  />
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

/** Phone photos are often bigger than the upload limit: anything large, or not a JPG, PNG or WebP, is redrawn at most 2000 px wide. */
async function shrink(file: File): Promise<Blob> {
  if (file.size <= 3.5 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const as = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.88));
  const webp = await as('image/webp'); // keeps a cut-out's transparent background
  return webp?.type === 'image/webp' ? webp : (await as('image/jpeg'))!;
}

function Photos() {
  const { data, refresh } = useLive();
  const run = useRun();
  const [q, setQ] = useState('');
  const [pending, setPending] = useState('');
  const photos = data?.photos || {};
  const list = useMemo(() => CATALOG.filter((p) => !p.gift && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))), [q]);
  const nice = (name: string) => name.charAt(0) + name.slice(1).toLowerCase();
  const upload = async (id: string, name: string, file: File | undefined) => {
    if (!file) return;
    setPending(id);
    await run(async () => {
      const form = new FormData();
      form.append('id', id);
      form.append('file', await shrink(file), file.name);
      const res = await fetch('/api/staff/menu/photo', { method: 'POST', body: form, cache: 'no-store' });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `The upload failed (${res.status}).`);
      await refresh();
    }, `${name} has its new photo on the site.`);
    setPending('');
  };
  const reset = async (id: string, name: string) => {
    setPending(id);
    await run(() => api('/api/staff/menu/photo', { id, reset: true }).then(refresh), `${name} is back to its original photo.`);
    setPending('');
  };
  const builtIn = CATALOG.filter((p) => !p.gift && !photos[p.id] && productImage(p)).length;
  const copyAll = async () => {
    setPending('all');
    await run(async () => {
      const out = await api<{ copied: number; failed: string[] }>('/api/staff/menu/photo', { copyAll: true });
      await refresh();
      if (out.failed.length) throw new Error(`${out.copied} copied; these did not go: ${out.failed.map(nice).join(', ')}. Try again.`);
    }, 'Every menu photo is now on Cloudinary, ready to replace.');
    setPending('');
  };
  return (
    <section className="cx-card">
      <div className="cx-card-h">
        <div className="cx-stack" style={{ gap: 4 }}>
          <p className="cx-h2">Menu photos</p>
          <p className="cx-small cx-muted">Your own photo of an item replaces the one on the site, everywhere on the home page: the menu, the item&apos;s details and the bag. JPG, PNG, WebP or AVIF; big phone photos are shrunk before they upload. A square photo looks best.</p>
        </div>
        <div className="cx-row" style={{ gap: 8 }}>
          {builtIn > 0 && (
            <button type="button" className="cx-btn sm" disabled={pending === 'all'} onClick={copyAll}>
              {pending === 'all' ? 'Copying…' : `Copy ${builtIn} built-in photos to Cloudinary`}
            </button>
          )}
          <input className="cx-input" style={{ maxWidth: 220 }} placeholder="Find an item" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="cx-grid three">
        {list.map((p) => {
          const own = photos[p.id];
          const src = own || productImage(p);
          return (
            <div key={p.id} className="cx-row" style={{ flexWrap: 'nowrap', gap: 12 }}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- a small preview of a picture that may be on Cloudinary
                <img src={src} alt="" width={56} height={56} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: 'var(--cx-line, #222)', flex: 'none' }} />
              ) : (
                <span style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--cx-line, #222)', flex: 'none' }} />
              )}
              <div className="cx-stack" style={{ gap: 4, minWidth: 0 }}>
                <span>
                  {nice(p.name)}
                  {own && <span className="cx-small cx-muted"> · your photo</span>}
                </span>
                <div className="cx-row" style={{ gap: 6 }}>
                  <label className="cx-btn sm" aria-disabled={pending === p.id} style={{ cursor: 'pointer', opacity: pending === p.id ? 0.5 : 1 }}>
                    {pending === p.id ? 'Uploading…' : own ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/*"
                      hidden
                      disabled={pending === p.id}
                      aria-label={`Photo of ${p.name}`}
                      onChange={(e) => {
                        upload(p.id, nice(p.name), e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {own && (
                    <button type="button" className="cx-btn sm" disabled={pending === p.id} onClick={() => reset(p.id, nice(p.name))}>
                      Use original
                    </button>
                  )}
                </div>
              </div>
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
  const blank = { code: '', pct: 10, note: '', maxUses: '', minTotal: '', expires: '', oncePerCustomer: false, hint: false };
  const [form, setForm] = useState(blank);
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
          <p className="cx-small cx-muted">A percentage off the bill (after a club free drink). Only the code marked Suggested is shown to visitors; every other code stays private until someone types it.</p>
        </div>
      </div>
      <form
        className="cx-row"
        style={{ marginBottom: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await post({ action: 'create', ...form, code: form.code.toUpperCase() }, `${form.code.toUpperCase()} is live.`)) setForm(blank);
        }}
      >
        <input className="cx-input" style={{ maxWidth: 170, textTransform: 'uppercase' }} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z0-9]/gi, '') })} aria-label="Code" maxLength={24} />
        <label className="cx-row cx-small">
          <input className="cx-input" style={{ width: 80 }} type="number" min={1} max={50} value={form.pct} onChange={(e) => setForm({ ...form, pct: +e.target.value })} aria-label="Percent off" />% off
        </label>
        <input className="cx-input" style={{ maxWidth: 260 }} placeholder="Note (who it's for)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={80} />
        <label className="cx-row cx-small">
          <input className="cx-input" style={{ width: 90 }} type="number" min={1} placeholder="No cap" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} aria-label="Most times it can be used" />
          uses
        </label>
        <label className="cx-row cx-small">
          <input className="cx-input" style={{ width: 150 }} type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} aria-label="Last day it works" />
          ends
        </label>
        <label className="cx-row cx-small">
          Rs
          <input className="cx-input" style={{ width: 90 }} type="number" min={1} placeholder="No min" value={form.minTotal} onChange={(e) => setForm({ ...form, minTotal: e.target.value })} aria-label="Smallest order it applies to" />
          minimum
        </label>
        <label className="cx-row cx-small">
          <input type="checkbox" checked={form.oncePerCustomer} onChange={(e) => setForm({ ...form, oncePerCustomer: e.target.checked })} /> once per customer
        </label>
        <label className="cx-row cx-small">
          <input type="checkbox" checked={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.checked })} /> suggest on the site
        </label>
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
                <th>Rules</th>
                <th className="r">Used</th>
                <th>Since</th>
                <th>On</th>
                <th>Suggested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.code}>
                  <td className="cx-mono">{p.code}</td>
                  <td>{p.pct}%</td>
                  <td className="cx-muted">{p.note || '—'}</td>
                  <td className="cx-muted cx-small">{promoRulesLabel(p) || 'No limits'}</td>
                  <td className="r cx-num">
                    {p.uses}
                    {p.maxUses ? ` / ${p.maxUses}` : ''}
                  </td>
                  <td className="cx-muted cx-small">{p.createdAt ? pkDate(p.createdAt) : 'From the start'}</td>
                  <td>
                    <button type="button" role="switch" className="cx-switch" aria-checked={p.active} aria-label={`${p.code} active`} onClick={() => post({ action: 'toggle', code: p.code })} />
                  </td>
                  <td>
                    <button type="button" role="switch" className="cx-switch" aria-checked={!!p.hint} aria-label={`Suggest ${p.code} on the site`} onClick={() => post({ action: 'hint', code: p.code }, p.hint ? `${p.code} is private again.` : `The site now suggests ${p.code}.`)} />
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
