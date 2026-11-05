'use client';

import { useEffect, useRef, useState } from 'react';
import { monthLabel, PAY_KINDS, type PayMonth, type PayPlan } from '@/lib/payroll';
import { api, rs } from './api';
import { Face } from './PayrollScreen';
import { useMe } from './Shell';
import { useRun } from './Toasts';

const BIO_MAX = 140;

/** Your photo and a line about you: customers see them when you're their rider or served their table. */
export function ProfileCard() {
  const { me } = useMe();
  const run = useRun();
  const [photo, setPhoto] = useState('');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ user: { photo?: string; bio?: string } }>('/api/staff/me')
      .then(({ user }) => {
        setPhoto(user.photo || '');
        setBio(user.bio || '');
        setSaved(user.bio || '');
      })
      .catch(() => {});
  }, []);

  const upload = async (f: File) => {
    const body = new FormData();
    body.append('file', f);
    setBusy(true);
    const r = await run(async () => {
      const res = await fetch('/api/staff/me/photo', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That photo didn’t upload. Try another.');
      return data as { user: { photo?: string } };
    }, 'Photo updated. Customers see it from now on.');
    if (r) setPhoto(r.user.photo || '');
    setBusy(false);
  };

  return (
    <section className="cx-card cx-stack" style={{ gap: 14 }}>
      <p className="cx-h2">Your profile</p>
      <p className="cx-small cx-muted">Customers see your photo and this line when you’re delivering their order or serving their table. A clear, friendly face photo works best.</p>
      <div className="cx-row" style={{ flexWrap: 'nowrap', gap: 16 }}>
        <Face name={me.name} photo={photo} size={84} />
        <div className="cx-stack" style={{ gap: 8 }}>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="cx-btn sm" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Uploading…' : photo ? 'Change photo' : 'Add a photo'}
          </button>
          {photo && (
            <button
              type="button"
              className="cx-btn sm"
              onClick={async () => {
                const r = await run(() => api<{ user: { photo?: string } }>('/api/staff/me/photo', { remove: true }), 'Photo removed.');
                if (r) setPhoto('');
              }}
            >
              Remove
            </button>
          )}
          <p className="cx-small cx-faint">JPG, PNG or WebP, up to 4 MB.</p>
        </div>
      </div>
      <label className="cx-field">
        <span>
          About you · {bio.length}/{BIO_MAX}
        </span>
        <textarea rows={2} maxLength={BIO_MAX} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={me.role === 'rider' ? 'Riding for brewns for 2 years. I’ll call when I’m outside.' : 'Pulling shots at MM Alam since 2023. Ask me for a pour-over.'} />
      </label>
      <button
        type="button"
        className="cx-btn"
        disabled={bio.trim() === saved.trim()}
        onClick={async () => {
          const r = await run(() => api('/api/staff/me', { bio }), 'Saved.');
          if (r) setSaved(bio);
        }}
      >
        Save
      </button>
    </section>
  );
}

type Mine = { plan: PayPlan | null; months: { ym: string; month: PayMonth; totals: { base: number; add: number; less: number; net: number } }[] };

/** What you're paid: this month as it stands, and the months before. */
export function MyPayCard() {
  const [mine, setMine] = useState<Mine | null>(null);
  useEffect(() => {
    api<{ mine: Mine }>('/api/staff/payroll?mine=1')
      .then((r) => setMine(r.mine))
      .catch(() => setMine({ plan: null, months: [] }));
  }, []);
  if (!mine) return null;
  const [now, ...before] = mine.months;
  const day = mine.plan?.payDay;
  return (
    <section className="cx-card cx-stack" style={{ gap: 12 }}>
      <p className="cx-h2">My pay</p>
      {!mine.plan && !now?.month.items.length ? (
        <p className="cx-small cx-muted">Your salary isn’t set up here yet. Ask the owner.</p>
      ) : (
        now && (
          <>
            <div className="cx-row between" style={{ alignItems: 'flex-end' }}>
              <div>
                <p className="cx-eyebrow">{monthLabel(now.ym)}</p>
                <p className="cx-kpi-v">{rs(now.month.paid?.net ?? now.totals.net)}</p>
              </div>
              <span className={`cx-pill${now.month.paid ? ' ready' : ' received'}`}>{now.month.paid ? `Paid ${new Date(now.month.paid.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : day ? `Due on day ${day}` : 'Not paid yet'}</span>
            </div>
            <div className="cx-stack" style={{ gap: 4 }}>
              <div className="cx-row between">
                <span>Salary</span>
                <span className="cx-mono">{rs(now.totals.base)}</span>
              </div>
              {now.month.items.map((i) => (
                <div key={i.id} className="cx-row between">
                  <span>
                    {PAY_KINDS[i.kind].label}
                    {i.note && <span className="cx-muted"> · {i.note}</span>}
                  </span>
                  <span className="cx-mono" style={{ color: PAY_KINDS[i.kind].sign > 0 ? '#7fd6ac' : '#f19c9c' }}>
                    {PAY_KINDS[i.kind].sign > 0 ? '+' : '−'} {rs(i.amount)}
                  </span>
                </div>
              ))}
              {!now.month.paid && <p className="cx-small cx-muted">So far this month. Bonuses or deductions added before pay day change it.</p>}
            </div>
          </>
        )
      )}
      {before.length > 0 && (
        <>
          <div className="cx-divider" />
          <p className="cx-eyebrow">Earlier months</p>
          {before.map((m) => (
            <div key={m.ym} className="cx-row between">
              <span>{monthLabel(m.ym)}</span>
              <span className="cx-row" style={{ gap: 8 }}>
                <span className="cx-mono">{rs(m.month.paid?.net ?? m.totals.net)}</span>
                <span className={`cx-pill${m.month.paid ? ' ready' : ' late'}`}>{m.month.paid ? 'Paid' : 'Not paid'}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
