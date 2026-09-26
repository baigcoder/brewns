'use client';

import { useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_INFO } from '@/lib/rbac';
import { api } from './api';
import { useMe } from './Shell';
import { useRun } from './Toasts';

/** Your own account: name, password, sessions, and what your role lets you do. */
export function AccountScreen() {
  const { me, perms } = useMe();
  const run = useRun();
  const [name, setName] = useState(me.name);
  const [pw, setPw] = useState({ password: '', newPassword: '' });
  const signOutAll = async () => {
    if (!window.confirm('Sign out on every device, including this one?')) return;
    const r = await run(() => api<{ next: string }>('/api/auth/signout', { kind: 'staff', everywhere: true }));
    if (r) window.location.assign(r.next);
  };
  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {ROLE_INFO[me.role].label} · {me.shops.length ? me.shops.map((s) => LOC_TITLES[s]).join(', ') : 'All shops'}
          </p>
          <h1 className="cx-h1">My account</h1>
        </div>
      </div>
      <div className="cx-grid two">
        <section className="cx-card cx-stack" style={{ gap: 14 }}>
          <p className="cx-h2">You</p>
          <label className="cx-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </label>
          <label className="cx-field">
            <span>Email · ask an owner to change it</span>
            <input value={me.email} disabled />
          </label>
          <button type="button" className="cx-btn" disabled={name.trim() === me.name || name.trim().length < 2} onClick={() => run(() => api('/api/staff/me', { name }), 'Saved. It shows everywhere from your next page.')}>
            Save name
          </button>
          <div className="cx-divider" />
          <p className="cx-h2">Password</p>
          <form
            className="cx-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() => api('/api/staff/me', pw), 'Password changed. Your other devices are signed out.');
              if (ok) setPw({ password: '', newPassword: '' });
            }}
          >
            <label className="cx-field">
              <span>Current password</span>
              <input type="password" autoComplete="current-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            </label>
            <label className="cx-field">
              <span>New password · 8+ characters, letters and a number</span>
              <input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </label>
            <button className="cx-btn primary" disabled={!pw.password || pw.newPassword.length < 8}>
              Change password
            </button>
          </form>
          <div className="cx-divider" />
          <button type="button" className="cx-btn danger" onClick={signOutAll}>
            Sign out everywhere
          </button>
        </section>
        <section className="cx-card">
          <p className="cx-h2" style={{ marginBottom: 4 }}>
            What you can do
          </p>
          <p className="cx-small cx-muted" style={{ marginBottom: 14 }}>
            {ROLE_INFO[me.role].blurb} {me.role === 'owner' ? '' : 'Need more? Ask an owner: they set this on the Access page.'}
          </p>
          <ul className="cx-stack" style={{ gap: 8 }}>
            {ALL_PERMISSIONS.map((p) => (
              <li key={p} className="cx-row" style={{ flexWrap: 'nowrap', opacity: perms.includes(p) ? 1 : 0.4 }}>
                <span aria-hidden="true" style={{ width: 18, color: perms.includes(p) ? 'var(--cx-ready)' : 'var(--cx-faint)' }}>
                  {perms.includes(p) ? '✓' : '–'}
                </span>
                <span>
                  {PERMISSIONS[p].label}
                  <span className="sr-only">{perms.includes(p) ? ': allowed' : ': not allowed'}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
