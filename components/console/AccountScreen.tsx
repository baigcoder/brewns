'use client';

import { useMemo, useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_INFO } from '@/lib/rbac';
import { api } from './api';
import { useMe } from './Shell';
import { useRun } from './Toasts';

/**
 * Your own account: profile details, security, and real-time active permissions.
 * Permissions and roles reactively update when owners toggle permissions in Access Control.
 */
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

  const groups = useMemo(() => [...new Set(ALL_PERMISSIONS.map((p) => PERMISSIONS[p].group))], []);
  const activeCount = useMemo(() => ALL_PERMISSIONS.filter((p) => perms.includes(p)).length, [perms]);

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p className="cx-eyebrow" style={{ margin: 0 }}>
              <b>{'//'}</b> {ROLE_INFO[me.role].label} · {me.shops.length ? me.shops.map((s) => LOC_TITLES[s]).join(', ') : 'All shops'}
            </p>
            <span className="cx-live-tag" title="Real-time RBAC active">
              ● REALTIME ACTIVE
            </span>
          </div>
          <h1 className="cx-h1">My Account</h1>
        </div>
      </div>

      <div className="cx-grid two">
        <section className="cx-card cx-stack" style={{ gap: 14 }}>
          <p className="cx-h2">Profile &amp; Credentials</p>
          <label className="cx-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </label>
          <label className="cx-field">
            <span>Email · ask an owner to change it</span>
            <input value={me.email} disabled />
          </label>
          <label className="cx-field">
            <span>Assigned Role</span>
            <input value={`${ROLE_INFO[me.role].label} (${ROLE_INFO[me.role].blurb})`} disabled />
          </label>
          <button
            type="button"
            className="cx-btn"
            disabled={name.trim() === me.name || name.trim().length < 2}
            onClick={() => run(() => api('/api/staff/me', { name }), 'Saved. It shows everywhere from your next page.')}
          >
            Save name
          </button>

          <div className="cx-divider" />
          <p className="cx-h2">Change Password</p>
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

        {/* Real-time RBAC Permissions View */}
        <section className="cx-card cx-stack" style={{ gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="cx-h2" style={{ margin: 0 }}>
                Role Permissions
              </p>
              <p className="cx-small cx-muted" style={{ margin: '2px 0 0' }}>
                {ROLE_INFO[me.role].blurb}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="cx-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cx-ready)' }}>
                {activeCount} / {ALL_PERMISSIONS.length}
              </span>
              <span className="cx-faint cx-small" style={{ display: 'block', fontSize: 10 }}>ACTIVE</span>
            </div>
          </div>

          <div className="cx-stack" style={{ gap: 12 }}>
            {groups.map((group) => {
              const groupPerms = ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].group === group);
              const allowedInGroup = groupPerms.filter((p) => perms.includes(p)).length;
              return (
                <div
                  key={group}
                  style={{
                    background: 'var(--cx-panel-2)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    border: '1px solid var(--cx-line)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="cx-eyebrow" style={{ color: allowedInGroup > 0 ? 'var(--cx-text)' : 'var(--cx-faint)', fontSize: 10 }}>
                      {group}
                    </span>
                    <span className="cx-small cx-muted" style={{ fontSize: 11 }}>
                      {allowedInGroup} / {groupPerms.length}
                    </span>
                  </div>

                  <ul className="cx-stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                    {groupPerms.map((p) => {
                      const allowed = perms.includes(p);
                      return (
                        <li
                          key={p}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            borderRadius: 4,
                            opacity: allowed ? 1 : 0.45,
                            background: allowed ? 'rgb(47 179 122 / 0.05)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              aria-hidden="true"
                              style={{
                                width: 14,
                                textAlign: 'center',
                                fontWeight: 700,
                                color: allowed ? 'var(--cx-ready)' : 'var(--cx-faint)',
                              }}
                            >
                              {allowed ? '✓' : '–'}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: allowed ? 500 : 400 }}>
                              {PERMISSIONS[p].label}
                            </span>
                          </div>
                          <span
                            className="cx-mono"
                            style={{
                              fontSize: 9,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: allowed ? 'rgb(47 179 122 / 0.15)' : 'rgb(255 255 255 / 0.05)',
                              color: allowed ? 'var(--cx-ready)' : 'var(--cx-muted)',
                            }}
                          >
                            {allowed ? 'GRANTED' : 'RESTRICTED'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
