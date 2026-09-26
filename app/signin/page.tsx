'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ROLE_INFO, type Role, ROLES } from '@/lib/rbac';
import '@/components/console/console.css';

type StationPreset = {
  role: Role;
  name: string;
  email: string;
  station: string;
  blurb: string;
  workstationUrl: string;
  badge: string;
  color: string;
};

const STATIONS: StationPreset[] = [
  {
    role: 'owner',
    name: 'Hassan Baig',
    email: 'owner@brewns.pk',
    station: 'Executive Overview & Governance',
    blurb: 'Executive P&L, Access Matrix, multi-branch audit, and global café governance.',
    workstationUrl: '/dashboard/overview',
    badge: '👑 Root Owner',
    color: '#D98A2C',
  },
  {
    role: 'manager',
    name: 'Zainab Tariq',
    email: 'manager@brewns.pk',
    station: 'Shift Operations & Staff Roster',
    blurb: 'Live order pipeline, staff management, menu pricing, and daily analytics.',
    workstationUrl: '/dashboard/overview',
    badge: '⭐ Operations Manager',
    color: '#3B82F6',
  },
  {
    role: 'cashier',
    name: 'Bilal Khan',
    email: 'cashier@brewns.pk',
    station: 'POS Counter & Live Orders Desk',
    blurb: 'Walk-in orders, table billing, cash & card collection, and rider dispatch.',
    workstationUrl: '/dashboard/orders',
    badge: '💳 Head Cashier',
    color: '#10B981',
  },
  {
    role: 'barista',
    name: 'Hamza Sheikh',
    email: 'barista@brewns.pk',
    station: 'Espresso Bar KDS Screen',
    blurb: 'Specialty coffee extraction, drink prep queue, and bean stock management.',
    workstationUrl: '/dashboard/kitchen',
    badge: '☕ Lead Barista',
    color: '#F59E0B',
  },
  {
    role: 'chef',
    name: 'Chef Usman',
    email: 'chef@brewns.pk',
    station: 'Artisan Kitchen & Bakery KDS',
    blurb: 'Artisan bakery, sourdough toasties, hot dishes, and prep timers.',
    workstationUrl: '/dashboard/kitchen',
    badge: '🍳 Kitchen Chef',
    color: '#EC4899',
  },
  {
    role: 'waiter',
    name: 'Ali Raza',
    email: 'waiter@brewns.pk',
    station: 'Floor Map & Dine-In Tables',
    blurb: '12-table floor layout, live table status, guest call assistance, and bill delivery.',
    workstationUrl: '/dashboard/floor',
    badge: '🍽️ Floor Waiter',
    color: '#8B5CF6',
  },
  {
    role: 'rider',
    name: 'Kamran Akmal',
    email: 'rider@brewns.pk',
    station: 'Delivery Fleet Runs (Bike LEN-8492)',
    blurb: 'Doorstep deliveries, turn-by-turn routing, cash on delivery, and customer SMS.',
    workstationUrl: '/dashboard/deliveries',
    badge: '🛵 Fleet Rider',
    color: '#06B6D4',
  },
];

export default function SignInPage() {
  const [activeTab, setActiveTab] = useState<'launchpad' | 'credentials'>('launchpad');
  const [email, setEmail] = useState('owner@brewns.pk');
  const [password, setPassword] = useState('brewns123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [launchingRole, setLaunchingRole] = useState<Role | null>(null);

  // Instant 1-Click Launch for any of the 7 staff stations
  const handleLaunchStation = async (preset: StationPreset) => {
    setError('');
    setLaunchingRole(preset.role);

    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: preset.role, email: preset.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Could not connect to ${preset.station}.`);
        setLaunchingRole(null);
      } else {
        // Direct browser navigation ensures cookies & SSR permissions rehydrate cleanly
        window.location.href = data.homeUrl || preset.workstationUrl;
      }
    } catch {
      setError('Connection error. Please verify the local server is running.');
      setLaunchingRole(null);
    }
  };

  // Traditional credentials authentication
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed. Check your email or password.');
        setSubmitting(false);
      } else {
        window.location.href = data.homeUrl || '/dashboard/overview';
      }
    } catch {
      setError('Connection error. Please try again.');
      setSubmitting(false);
    }
  };

  // Detect station from typed email
  const detectedStation = STATIONS.find(
    (s) => s.email.toLowerCase() === email.trim().toLowerCase()
  );

  return (
    <div className="co-auth-wrapper">
      <div style={{ width: '100%', maxWidth: '980px', margin: '0 auto' }}>
        {/* Header Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '28px',
              letterSpacing: '0.22em',
              color: 'var(--co-cream)',
              display: 'inline-block',
            }}
          >
            BREWNS
          </Link>
          <div
            style={{
              margin: '6px 0 0',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: 'var(--co-amber-light)',
              letterSpacing: '0.12em',
            }}
          >
            SPECIALTY COFFEE HOUSE · STAFF WORKSTATION PORTAL
          </div>
          <p
            style={{
              margin: '8px auto 0',
              color: 'var(--co-cream-dim)',
              fontSize: '13px',
              maxWidth: '560px',
              lineHeight: 1.5,
            }}
          >
            Select a station below to launch directly with production role permissions, or authenticate using your staff credentials.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              color: '#F87171',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Mode Tabs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '28px',
            borderBottom: '1px solid var(--co-border)',
            paddingBottom: '16px',
          }}
        >
          <button
            type="button"
            className="btn-co"
            style={{
              background: activeTab === 'launchpad' ? 'var(--co-amber)' : 'rgba(255,255,255,0.06)',
              color: activeTab === 'launchpad' ? '#111' : 'var(--co-cream)',
              borderColor: activeTab === 'launchpad' ? 'var(--co-amber-light)' : 'var(--co-border)',
              padding: '10px 22px',
              fontWeight: 700,
              fontSize: '12px',
            }}
            onClick={() => setActiveTab('launchpad')}
          >
            ⚡ 1-Click Station Launchpad (All 7 Roles)
          </button>
          <button
            type="button"
            className="btn-co"
            style={{
              background: activeTab === 'credentials' ? 'var(--co-amber)' : 'rgba(255,255,255,0.06)',
              color: activeTab === 'credentials' ? '#111' : 'var(--co-cream)',
              borderColor: activeTab === 'credentials' ? 'var(--co-amber-light)' : 'var(--co-border)',
              padding: '10px 22px',
              fontWeight: 700,
              fontSize: '12px',
            }}
            onClick={() => setActiveTab('credentials')}
          >
            🔑 Custom Credentials Sign-In
          </button>
        </div>

        {/* TAB 1: 1-Click Station Launchpad */}
        {activeTab === 'launchpad' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              {STATIONS.map((preset) => {
                const isLaunching = launchingRole === preset.role;
                return (
                  <div
                    key={preset.role}
                    className={`co-station-card ${isLaunching ? 'active-launching' : ''}`}
                    onClick={() => !launchingRole && handleLaunchStation(preset)}
                  >
                    <div>
                      {/* Top Badges */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '10px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: `${preset.color}22`,
                            color: preset.color,
                            border: `1px solid ${preset.color}44`,
                          }}
                        >
                          {preset.badge}
                        </span>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            color: 'var(--co-cream-dim)',
                          }}
                        >
                          {preset.workstationUrl}
                        </span>
                      </div>

                      {/* Station Name & Staff Officer */}
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          margin: '0 0 4px',
                          color: 'var(--co-cream)',
                        }}
                      >
                        {preset.station}
                      </h3>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--co-amber-light)',
                          marginBottom: '8px',
                          fontWeight: 600,
                        }}
                      >
                        {preset.name} · <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>{preset.email}</span>
                      </div>

                      {/* Blurb */}
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--co-cream-dim)',
                          margin: '0 0 16px',
                          lineHeight: 1.45,
                        }}
                      >
                        {preset.blurb}
                      </p>
                    </div>

                    {/* Launch Action */}
                    <div
                      style={{
                        borderTop: '1px solid var(--co-border)',
                        paddingTop: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          color: 'var(--co-cream-faint)',
                        }}
                      >
                        PWD: brewns123
                      </span>
                      <button
                        type="button"
                        className="btn-co"
                        style={{
                          background: isLaunching ? 'var(--co-amber-light)' : 'rgba(255,255,255,0.08)',
                          color: isLaunching ? '#111' : 'var(--co-cream)',
                          borderColor: isLaunching ? 'var(--co-amber-light)' : 'var(--co-border)',
                          padding: '6px 14px',
                          fontSize: '11px',
                        }}
                        disabled={Boolean(launchingRole)}
                      >
                        {isLaunching ? 'Connecting...' : 'Launch Station →'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: '24px',
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: 'var(--co-cream-dim)',
              }}
            >
              🔒 ALL ROLES AUTHENTICATED VIA PRODUCTION SCRYPT &amp; ENCRYPTED SESSION COOKIES
            </div>
          </div>
        )}

        {/* TAB 2: Custom Credentials Form */}
        {activeTab === 'credentials' && (
          <div
            style={{
              maxWidth: '460px',
              margin: '0 auto',
              background: '#181412',
              border: '1px solid var(--co-border-strong)',
              borderRadius: '16px',
              padding: '36px 32px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                margin: '0 0 6px',
                textAlign: 'center',
                color: 'var(--co-cream)',
              }}
            >
              Enterprise Sign In
            </h2>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--co-cream-dim)',
                textAlign: 'center',
                margin: '0 0 24px',
              }}
            >
              Sign in with your café staff email and password.
            </p>

            <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: 'var(--co-cream-dim)',
                    marginBottom: '6px',
                    letterSpacing: '0.04em',
                  }}
                >
                  STAFF EMAIL
                </label>
                <input
                  type="email"
                  className="co-input"
                  placeholder="e.g. owner@brewns.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                {detectedStation && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: detectedStation.color,
                      fontFamily: 'monospace',
                    }}
                  >
                    <span>⚡ Station:</span>
                    <strong>{detectedStation.badge}</strong>
                    <span>→ {detectedStation.workstationUrl}</span>
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: 'var(--co-cream-dim)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--co-amber-light)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="co-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-co btn-co-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
                disabled={submitting}
              >
                {submitting ? 'Verifying Credentials...' : 'Sign In to Station'}
              </button>
            </form>

            {/* Quick Fill Pills */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--co-border)', paddingTop: '18px' }}>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'var(--co-cream-dim)',
                  marginBottom: '10px',
                  textAlign: 'center',
                }}
              >
                QUICK-FILL ROLE CREDENTIALS (PWD: brewns123)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                {STATIONS.map((preset) => (
                  <button
                    key={preset.role}
                    type="button"
                    className="btn-co btn-co-secondary"
                    style={{ padding: '4px 9px', fontSize: '10px' }}
                    onClick={() => {
                      setEmail(preset.email);
                      setPassword('brewns123');
                    }}
                  >
                    {preset.role.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Global Footer Navigation */}
        <div
          style={{
            marginTop: '36px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--co-cream-dim)',
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/" style={{ color: 'var(--co-cream-dim)', textDecoration: 'none' }}>
            ← Return to Storefront
          </Link>
          <span style={{ color: 'var(--co-border)' }}>|</span>
          <Link href="/signup" style={{ color: 'var(--co-amber-light)', textDecoration: 'none', fontWeight: 600 }}>
            Initial Café Setup &amp; Owner Signup
          </Link>
        </div>
      </div>
    </div>
  );
}
