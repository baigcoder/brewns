'use client';

import React, { useEffect, useState } from 'react';
import {
  ROLES,
  ROLE_INFO,
  PERMISSIONS,
  PERMISSION_GROUPS,
  SECTIONS,
  canOpen,
  type Role,
  type Permission,
  type RolePerms,
  OWNER_ONLY,
  DEFAULT_ROLE_PERMS,
  type PermissionGroup,
} from '@/lib/rbac';

export function AccessScreen() {
  const [matrix, setMatrix] = useState<RolePerms | null>(null);
  const [initialMatrix, setInitialMatrix] = useState<RolePerms | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'matrix' | 'simulator'>('matrix');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [simRole, setSimRole] = useState<Role>('cashier');

  const fetchMatrix = async () => {
    try {
      const res = await fetch('/api/access');
      if (res.ok) {
        const data = await res.json();
        setMatrix(data.matrix);
        setInitialMatrix(JSON.parse(JSON.stringify(data.matrix)));
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const handleTogglePerm = (role: Role, perm: Permission) => {
    if (!matrix || role === 'owner' || OWNER_ONLY.includes(perm)) return;
    const current = matrix[role] || [];
    const updated = current.includes(perm)
      ? current.filter((p) => p !== perm)
      : [...current, perm];

    setMatrix({
      ...matrix,
      [role]: updated,
    });
  };

  const handleResetDefaults = () => {
    if (confirm('Reset entire permission matrix to Brewns recommended factory defaults?')) {
      setMatrix(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS)));
    }
  };

  const handleSaveMatrix = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matrix),
      });

      if (res.ok) {
        setSavedMsg('✓ Access Matrix saved and enforced enterprise-wide.');
        setInitialMatrix(JSON.parse(JSON.stringify(matrix)));
        setTimeout(() => setSavedMsg(''), 4000);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update access matrix');
      }
    } catch {
      alert('Network error while saving matrix');
    } finally {
      setSaving(false);
    }
  };

  if (!matrix) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--co-cream-dim)' }}>
        Loading access matrix...
      </div>
    );
  }

  // Calculate pending unsaved changes
  let unsavedCount = 0;
  if (initialMatrix) {
    for (const r of ROLES) {
      if (r === 'owner') continue;
      const curr = new Set(matrix[r] || []);
      const init = new Set(initialMatrix[r] || []);
      for (const p of curr) if (!init.has(p)) unsavedCount++;
      for (const p of init) if (!curr.has(p)) unsavedCount++;
    }
  }

  const editableRoles = ROLES.filter((r) => r !== 'owner');
  const permsEntries = Object.entries(PERMISSIONS) as [Permission, (typeof PERMISSIONS)[keyof typeof PERMISSIONS]][];

  // Group filter
  const filteredPerms = permsEntries.filter(([, meta]) => {
    if (selectedGroup === 'all') return true;
    return meta.group === selectedGroup;
  });

  // Role simulator calculations
  const simPerms = matrix[simRole] || [];
  const simVisibleSections = SECTIONS.filter((s) => canOpen(simPerms, s));
  const simBlockedSections = SECTIONS.filter((s) => !canOpen(simPerms, s));

  return (
    <div>
      {/* Header with Title and Global Actions */}
      <div className="co-page-title" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>Access Control Matrix</h1>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(217, 138, 44, 0.2)',
                color: 'var(--co-amber-light)',
                border: '1px solid rgba(217, 138, 44, 0.4)',
                fontWeight: 700,
              }}
            >
              👑 ROOT OWNER GOVERNANCE
            </span>
          </div>
          <p>Configure enterprise role permissions, station boundaries, and security policies in real time.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {unsavedCount > 0 && (
            <span
              style={{
                fontSize: '12px',
                color: '#FBBF24',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
              }}
            >
              ● {unsavedCount} pending change{unsavedCount === 1 ? '' : 's'}
            </span>
          )}

          {savedMsg && (
            <span style={{ color: 'var(--co-green)', fontSize: '13px', fontWeight: 600 }}>
              {savedMsg}
            </span>
          )}

          <button
            type="button"
            className="btn-co btn-co-secondary"
            onClick={handleResetDefaults}
            title="Restore default hospitality role permissions"
          >
            Reset Defaults
          </button>

          <button
            type="button"
            className="btn-co btn-co-primary"
            onClick={handleSaveMatrix}
            disabled={saving || unsavedCount === 0}
          >
            {saving ? 'Enforcing...' : 'Save Matrix Changes'}
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--co-border)', paddingBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            background: activeTab === 'matrix' ? 'var(--co-panel)' : 'transparent',
            border: `1px solid ${activeTab === 'matrix' ? 'var(--co-amber)' : 'transparent'}`,
            color: activeTab === 'matrix' ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🔐 Granular Permission Grid
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          style={{
            background: activeTab === 'simulator' ? 'var(--co-panel)' : 'transparent',
            border: `1px solid ${activeTab === 'simulator' ? 'var(--co-amber)' : 'transparent'}`,
            color: activeTab === 'simulator' ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🔍 Role Access Simulator &amp; Audit
        </button>
      </div>

      {activeTab === 'matrix' ? (
        <div>
          {/* Functional Group Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              style={{
                background: selectedGroup === 'all' ? 'var(--co-panel)' : 'transparent',
                border: `1px solid ${selectedGroup === 'all' ? 'var(--co-amber)' : 'var(--co-border)'}`,
                color: selectedGroup === 'all' ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Categories ({permsEntries.length})
            </button>

            {PERMISSION_GROUPS.map((g) => {
              const count = permsEntries.filter(([, m]) => m.group === g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroup(g.id)}
                  style={{
                    background: selectedGroup === g.id ? 'var(--co-panel)' : 'transparent',
                    border: `1px solid ${selectedGroup === g.id ? 'var(--co-amber)' : 'var(--co-border)'}`,
                    color: selectedGroup === g.id ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {g.icon} {g.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Interactive Matrix Grid */}
          <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', overflowX: 'auto' }}>
            <table className="co-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '260px' }}>PERMISSION &amp; PURPOSE</th>
                  <th style={{ textAlign: 'center', minWidth: '100px', background: 'rgba(217, 138, 44, 0.08)' }}>
                    <div style={{ color: 'var(--co-amber-light)', fontWeight: 800 }}>OWNER</div>
                    <div style={{ fontSize: '10px', color: 'var(--co-cream-dim)' }}>👑 ROOT</div>
                  </th>
                  {editableRoles.map((r) => (
                    <th key={r} style={{ textAlign: 'center', minWidth: '95px' }}>
                      <div style={{ color: ROLE_INFO[r].color, fontWeight: 700 }}>{ROLE_INFO[r].label.toUpperCase()}</div>
                      <div style={{ fontSize: '10px', color: 'var(--co-cream-dim)' }}>{ROLE_INFO[r].badge}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPerms.map(([permKey, permMeta]) => {
                  const isOwnerOnly = OWNER_ONLY.includes(permKey);

                  return (
                    <tr key={permKey}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--co-cream)' }}>{permMeta.label}</span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '10px',
                              background: 'rgba(255,255,255,0.06)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              color: 'var(--co-cream-dim)',
                            }}
                          >
                            {permKey}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '2px' }}>
                          {permMeta.desc}
                        </div>
                      </td>

                      {/* Owner Column: Always Granted */}
                      <td style={{ textAlign: 'center', background: 'rgba(217, 138, 44, 0.04)' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--co-amber-light)',
                            fontWeight: 700,
                          }}
                        >
                          ✓ ALL
                        </span>
                      </td>

                      {/* Configurable Staff Roles */}
                      {editableRoles.map((r) => {
                        const hasPerm = (matrix[r] || []).includes(permKey);

                        if (isOwnerOnly) {
                          return (
                            <td key={r} style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)', opacity: 0.4 }} title="Restricted to Root Owner only">
                                🔒 Locked
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={r} style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={hasPerm}
                              onChange={() => handleTogglePerm(r, permKey)}
                              style={{
                                cursor: 'pointer',
                                width: '17px',
                                height: '17px',
                                accentColor: ROLE_INFO[r].color || 'var(--co-amber)',
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Role Simulator & Security Inspector */
        <div>
          <div style={{ background: 'var(--co-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--co-border)', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>Select Role to Audit</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--co-cream-dim)' }}>
              Inspect live visibility, permitted navigation routes, and restricted actions for any staff tier.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {editableRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSimRole(r)}
                  style={{
                    background: simRole === r ? 'var(--co-card)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${simRole === r ? ROLE_INFO[r].color : 'var(--co-border)'}`,
                    color: simRole === r ? ROLE_INFO[r].color : 'var(--co-cream)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>{ROLE_INFO[r].label}</span>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>({(matrix[r] || []).length} perms)</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Permitted Sections */}
            <div style={{ background: 'var(--co-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--co-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, color: 'var(--co-green)', fontSize: '14px' }}>
                  ✓ AUTHORIZED CONSOLES ({simVisibleSections.length})
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {simVisibleSections.map((sec) => (
                  <div
                    key={sec.key}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--co-card)',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{sec.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginLeft: '8px' }}>
                        {sec.href}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--co-green)' }}>ALLOWED</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Blocked Sections */}
            <div style={{ background: 'var(--co-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--co-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, color: '#F87171', fontSize: '14px' }}>
                  ⛔ RESTRICTED CONSOLES (403 BLOCKED) ({simBlockedSections.length})
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {simBlockedSections.map((sec) => (
                  <div
                    key={sec.key}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--co-cream)' }}>{sec.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginLeft: '8px' }}>
                        {sec.href}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#F87171' }}>
                      REQUIRES {sec.any[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
