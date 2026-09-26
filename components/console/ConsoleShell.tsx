'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SECTIONS,
  canOpen,
  type Role,
  ROLE_INFO,
  ROLES,
  permsFor,
} from '@/lib/rbac';
import './console.css';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  shops: number[];
  riderPlate?: string;
};

function playTestChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignored
  }
}

export function ConsoleShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  // Dropdown States
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [chimeEnabled, setChimeEnabled] = useState(true);

  const [switchingRole, setSwitchingRole] = useState<string | null>(null);

  const adminMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPerms(data.perms);
      } else {
        window.location.href = '/signin';
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const pollLive = async () => {
    try {
      const res = await fetch('/api/live');
      if (res.ok) {
        const data = await res.json();
        setActiveOrdersCount(data.activeOrders || 0);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchUser();
    pollLive();
    const interval = setInterval(pollLive, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setShowAdminMenu(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSwitchRole = async (targetRole: Role) => {
    if (user?.role === targetRole) {
      setShowRoleMenu(false);
      return;
    }
    setSwitchingRole(targetRole);
    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.homeUrl || '/dashboard/overview';
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Station switch failed: ${err.error || 'Server error'}`);
        setSwitchingRole(null);
      }
    } catch {
      alert('Connection error. Could not switch station.');
      setSwitchingRole(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      window.location.href = '/signin';
    } catch {
      window.location.href = '/signin';
    }
  };

  const toggleSound = () => {
    const next = !chimeEnabled;
    setChimeEnabled(next);
    if (next) playTestChime();
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--co-bg)',
          color: 'var(--co-cream)',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}
      >
        <span>INITIALIZING BREWNS ENTERPRISE CONSOLE...</span>
      </div>
    );
  }

  if (!user) return null;

  // Categorized Sections
  const opsSections = SECTIONS.filter(
    (s) => s.group === 'Operations' && canOpen(perms, s)
  );
  const adminSections = SECTIONS.filter(
    (s) => s.group === 'Administration' && canOpen(perms, s)
  );

  const isAdminActive = adminSections.some((s) => pathname === s.href);

  return (
    <div className="co-console">
      {/* Main Sticky Header */}
      <header className="co-header">
        {/* Brand & Console Badge */}
        <div className="co-header-brand">
          <Link href="/" className="co-logo-text">
            BREWNS
          </Link>
          <span
            className="co-console-badge"
            style={{
              borderColor: ROLE_INFO[user.role]?.color || 'var(--co-amber)',
              color: ROLE_INFO[user.role]?.color || 'var(--co-amber-light)',
            }}
          >
            {ROLE_INFO[user.role]?.badge || user.role.toUpperCase()} CONSOLE
          </span>
        </div>

        {/* Categorized Primary Navigation */}
        <nav className="co-header-nav" aria-label="Staff navigation">
          {/* Operations Tabs */}
          {opsSections.map((sec) => {
            const isActive = pathname === sec.href;
            return (
              <Link
                key={sec.key}
                href={sec.href}
                className={`co-nav-link ${isActive ? 'active' : ''}`}
              >
                <span>{sec.label}</span>
                {sec.key === 'orders' && activeOrdersCount > 0 && (
                  <span className="co-nav-badge">{activeOrdersCount}</span>
                )}
              </Link>
            );
          })}

          {/* Administration & Enterprise Menu Dropdown */}
          {adminSections.length > 0 && (
            <div className="co-nav-dropdown" ref={adminMenuRef}>
              <button
                type="button"
                className={`co-dropdown-trigger ${isAdminActive ? 'active' : ''}`}
                onClick={() => setShowAdminMenu(!showAdminMenu)}
              >
                <span>Enterprise</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>▾</span>
              </button>

              {showAdminMenu && (
                <div className="co-dropdown-popover">
                  <div style={{ padding: '6px 10px 4px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', borderBottom: '1px solid var(--co-border)' }}>
                    MANAGEMENT &amp; GOVERNANCE
                  </div>
                  {adminSections.map((sec) => {
                    const isItemActive = pathname === sec.href;
                    return (
                      <Link
                        key={sec.key}
                        href={sec.href}
                        className={`co-dropdown-item ${isItemActive ? 'active' : ''}`}
                        onClick={() => setShowAdminMenu(false)}
                      >
                        <span>{sec.label}</span>
                        {sec.badge && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '9px',
                              fontFamily: 'monospace',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'rgba(217, 138, 44, 0.2)',
                              color: 'var(--co-amber-light)',
                            }}
                          >
                            {sec.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Right Action Suite */}
        <div className="co-header-actions">
          {/* Universal Workstation Switcher for testing and multi-role operations */}
          <div className="co-nav-dropdown" ref={roleMenuRef}>
            <button
              type="button"
              className="btn-co btn-co-secondary"
              style={{
                padding: '5px 11px',
                fontSize: '11px',
                borderColor: switchingRole ? 'var(--co-amber-light)' : 'var(--co-border-strong)',
                color: 'var(--co-cream)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              title="Switch to another staff role or workstation"
            >
              <span>{switchingRole ? '⏳ Switching...' : `⚡ ${ROLE_INFO[user.role]?.label || user.role}`}</span>
              <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
            </button>

            {showRoleMenu && (
              <div
                className="co-dropdown-popover"
                style={{
                  right: 0,
                  left: 'auto',
                  minWidth: '290px',
                  padding: '6px',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  style={{
                    padding: '8px 10px 6px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: 'var(--co-cream-dim)',
                    borderBottom: '1px solid var(--co-border)',
                    letterSpacing: '0.06em',
                  }}
                >
                  BREWNS STATIONS · INSTANT SWITCH
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {ROLES.map((r) => {
                    const info = ROLE_INFO[r];
                    const isCurrent = user.role === r;
                    const isTargetSwitching = switchingRole === r;
                    const stationLabel =
                      r === 'owner' ? 'Executive Overview' :
                      r === 'manager' ? 'Shift & Inventory' :
                      r === 'cashier' ? 'POS Counter & Orders' :
                      r === 'barista' ? 'Espresso Bar KDS' :
                      r === 'chef' ? 'Kitchen Station KDS' :
                      r === 'waiter' ? 'Floor & Table Map' : 'Delivery Fleet Runs';

                    return (
                      <button
                        key={r}
                        type="button"
                        className={`co-dropdown-item ${isCurrent ? 'active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: isTargetSwitching ? 'wait' : 'pointer',
                          background: isCurrent ? 'rgba(217, 138, 44, 0.15)' : 'none',
                          border: 'none',
                          width: '100%',
                          textAlign: 'left',
                          opacity: isTargetSwitching ? 0.6 : 1,
                        }}
                        onClick={() => handleSwitchRole(r)}
                        disabled={Boolean(switchingRole)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px' }}>{info.badge.split(' ')[0]}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: isCurrent ? 'var(--co-amber-light)' : 'var(--co-cream)' }}>
                              {info.label}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--co-cream-dim)' }}>
                              {stationLabel}
                            </div>
                          </div>
                        </div>

                        {isCurrent ? (
                          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--co-green)', fontWeight: 700, padding: '2px 5px', borderRadius: '3px', background: 'rgba(34, 197, 94, 0.15)' }}>
                            CURRENT
                          </span>
                        ) : isTargetSwitching ? (
                          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--co-amber-light)' }}>
                            LOADING...
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--co-cream-faint)' }}>
                            Switch →
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sound Chime Toggle */}
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 9px', fontSize: '12px' }}
            onClick={toggleSound}
            title={chimeEnabled ? 'Order chimes active. Click to mute.' : 'Sound muted. Click to enable.'}
          >
            {chimeEnabled ? '🔔' : '🔕'}
          </button>

          {/* Real-time Heartbeat Indicator */}
          <div className="co-live-indicator">
            <span className="co-pulse-dot" />
            <span>LIVE</span>
          </div>

          {/* User Profile Pill */}
          <div className="co-user-pill">
            <div className="co-user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="co-user-name">{user.name}</div>
              <div className="co-user-role">{ROLE_INFO[user.role]?.label || user.role}</div>
            </div>
          </div>

          {/* Sign Out */}
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="co-main">{children}</main>
    </div>
  );
}
