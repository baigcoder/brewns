'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { LOC_TITLES } from '@/lib/catalog';

const SELECTABLE_ROLES: readonly Role[] = ['barista', 'chef', 'waiter', 'cashier', 'rider', 'manager'];

const ROLE_ICONS: Record<string, string> = {
  barista: '☕',
  chef: '🍳',
  waiter: '🍽️',
  cashier: '💳',
  rider: '🛵',
  manager: '👔',
};

export function StaffSignupForm({ initialRole }: { initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole && SELECTABLE_ROLES.includes(initialRole) ? initialRole : 'barista');
  const [shop, setShop] = useState<string>('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <div className="auth-form auth-form-wide">
        <p className="cx-eyebrow" style={{ marginBottom: '4px' }}>
          <b>{'//'}</b> Staff sign-up
        </p>
        <h2>Request sent</h2>
        <p className="cx-muted" style={{ marginTop: '4px', fontSize: '13px' }}>
          The owner or a manager will check your details and switch your account on from Team. After that, sign in with the email and password you just chose.
        </p>
        <Link href="/staff/signin" className="cx-btn primary" style={{ marginTop: '12px', justifyContent: 'center' }}>
          Go to sign in
        </Link>
      </div>
    );

  return (
    <form
      className="auth-form auth-form-wide"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');

        const form = new FormData(e.currentTarget);
        const body: Record<string, unknown> = {
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          phone: form.get('phone'),
          plate: form.get('plate'),
          role,
          shop: shop === 'all' ? 'all' : Number(shop),
        };

        const next = new URLSearchParams(location.search).get('next');
        if (next) body.next = next;

        try {
          const res = await fetch('/api/auth/staff-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
          setSent(true);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="cx-eyebrow" style={{ marginBottom: '4px' }}>
          <b>{'//'}</b> Staff sign-up
        </p>
        <h2>Join the team</h2>
        <p className="cx-muted" style={{ marginTop: '4px', fontSize: '13px' }}>
          Pick your station. The owner or a manager approves new accounts before they can sign in.
        </p>
      </div>

      {/* Compact 3x2 Role Grid */}
      <div className="cx-field">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Station &amp; Role</span>
          <span className="cx-small cx-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Choose station
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {SELECTABLE_ROLES.map((r) => {
            const active = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  padding: '9px 10px',
                  borderRadius: '9px',
                  border: active ? '1px solid var(--cx-accent, #c99355)' : '1px solid var(--cx-line-2, #262624)',
                  background: active ? 'rgba(201, 147, 85, 0.16)' : '#141413',
                  color: active ? '#f5ede3' : 'var(--cx-muted, #8e8d88)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s ease',
                  boxShadow: active ? '0 0 12px rgba(201, 147, 85, 0.2)' : 'none',
                }}
              >
                <span style={{ fontSize: '15px' }}>{ROLE_ICONS[r]}</span>
                <span>{ROLE_INFO[r].label}</span>
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(201, 147, 85, 0.08)',
            border: '1px solid rgba(201, 147, 85, 0.22)',
            color: '#f2ece4',
            fontSize: '12px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: 'var(--cx-accent, #c99355)', fontWeight: 600 }}>
            {ROLE_INFO[role].label} Station:
          </span>
          <span style={{ opacity: 0.9 }}>{ROLE_INFO[role].blurb}</span>
        </div>
      </div>

      {/* Row 1: Name and Email */}
      <div className="auth-grid-2">
        <label className="cx-field">
          <span>Your Full Name</span>
          <input name="name" type="text" autoComplete="name" placeholder="e.g. Bilal Tariq" required maxLength={60} />
        </label>

        <label className="cx-field">
          <span>Work Email</span>
          <input name="email" type="email" autoComplete="email" placeholder="name@brewns.coffee" required maxLength={120} />
        </label>
      </div>

      {/* Row 2: Password and Location */}
      <div className="auth-grid-2">
        <label className="cx-field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="new-password" placeholder="••••••••" required maxLength={100} />
          <small className="cx-small cx-muted">Min. 8 characters</small>
        </label>

        <label className="cx-field">
          <span>Shop Location</span>
          <select
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            className="cx-select"
          >
            <option value="all">All shops (Roastery &amp; all branches)</option>
            {LOC_TITLES.map((title, idx) => (
              <option key={idx} value={idx}>
                {title}
              </option>
            ))}
          </select>
          <small className="cx-small cx-muted">Assigned branch</small>
        </label>
      </div>

      {/* Row 3: Conditional Rider Plate and Phone */}
      {role === 'rider' ? (
        <div className="auth-grid-2">
          <label className="cx-field">
            <span>Bike / Scooter Plate</span>
            <input name="plate" type="text" placeholder="e.g. LEA-1234" maxLength={20} />
            <small className="cx-small cx-muted">Customer delivery map</small>
          </label>

          <label className="cx-field">
            <span>Phone</span>
            <input name="phone" type="tel" autoComplete="tel" placeholder="0300 1234567" maxLength={20} />
          </label>
        </div>
      ) : (
        <label className="cx-field">
          <span>Phone (Optional)</span>
          <input name="phone" type="tel" autoComplete="tel" placeholder="0300 1234567" maxLength={20} />
        </label>
      )}

      {error && (
        <p className="auth-err" role="alert">
          {error}
        </p>
      )}

      <button className="cx-btn primary big block" disabled={busy} style={{ marginTop: '4px' }}>
        {busy ? 'Creating account…' : `Sign up as ${ROLE_INFO[role].label} →`}
      </button>

      <div className="auth-alt" style={{ marginTop: '2px' }}>
        <p>
          Already have an account? <Link href="/staff/signin">Staff sign-in</Link>
        </p>
        <p>
          First time café setup? <Link href="/owner/signup">Claim owner account</Link>
        </p>
      </div>
    </form>
  );
}
