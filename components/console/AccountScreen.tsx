'use client';

import React, { useEffect, useState } from 'react';
import { ROLE_INFO, type Role, PERMISSIONS, type Permission } from '@/lib/rbac';
import { LOCS, LOC_TITLES } from '@/lib/catalog';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  shops: number[];
  riderPlate?: string;
};

export function AccountScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          setPerms(data.perms || []);
        }
      })
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--co-cream-dim)' }}>
        Loading account details...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div className="co-page-title">
        <div>
          <h1>My Account</h1>
          <p>Personal profile, role assignments, and active permissions.</p>
        </div>
      </div>

      <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--co-amber-dim)',
              color: 'var(--co-amber-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 800,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>{user.name}</h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--co-amber-dim)',
                  color: 'var(--co-amber-light)',
                }}
              >
                {ROLE_INFO[user.role]?.label || user.role}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--co-cream-dim)' }}>{user.email}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid var(--co-border)', paddingTop: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>PHONE NUMBER</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>{user.phone}</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>ASSIGNED SHOPS</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
              {user.shops.length === 0 || user.shops.length === 3
                ? 'All 3 Locations (Gulberg, DHA, Johar Town)'
                : user.shops.map((s) => LOC_TITLES[s] || LOCS[s]?.[0]).join(', ')}
            </div>
          </div>

          {user.riderPlate && (
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>MOTORCYCLE PLATE</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>{user.riderPlate}</div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>ROLE DESCRIPTION</div>
            <div style={{ fontSize: '13px', color: 'var(--co-cream)', marginTop: '4px' }}>
              {ROLE_INFO[user.role]?.blurb}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', padding: '28px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px' }}>Active Permissions on this Station</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {perms.map((p) => {
            const meta = PERMISSIONS[p as Permission];
            return (
              <div
                key={p}
                style={{
                  background: 'var(--co-card)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: '1px solid var(--co-border)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--co-amber-light)' }}>
                  ✓ {meta?.label || p}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '2px' }}>
                  {meta?.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
