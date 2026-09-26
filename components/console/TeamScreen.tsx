'use client';

import React, { useEffect, useState } from 'react';
import type { StaffUser, Invite } from '@/lib/server/storage';
import {
  ROLES,
  ROLE_INFO,
  type Role,
  type Permission,
  PERMISSIONS,
  OWNER_ONLY,
  PERMISSION_GROUPS,
} from '@/lib/rbac';
import { LOCS, LOC_TITLES } from '@/lib/catalog';

interface StaffUserWithPerms extends StaffUser {
  customPerms?: Permission[];
  deniedPerms?: Permission[];
  effectivePerms?: Permission[];
}

export function TeamScreen() {
  const [staff, setStaff] = useState<StaffUserWithPerms[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  
  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<Role>('barista');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteShop, setInviteShop] = useState(0);
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null);

  // Per-User Permissions Override Modal State
  const [selectedStaff, setSelectedStaff] = useState<StaffUserWithPerms | null>(null);
  const [editingCustomPerms, setEditingCustomPerms] = useState<Permission[]>([]);
  const [editingDeniedPerms, setEditingDeniedPerms] = useState<Permission[]>([]);
  const [savingOverrides, setSavingOverrides] = useState(false);

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/staff');
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
        setInvites(data.invites || []);
      }
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const me = await meRes.json();
        setCurrentUserRole(me.user?.role || '');
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: inviteRole,
          shops: [inviteShop],
          email: inviteEmail || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedInviteToken(data.invite?.token || null);
        fetchTeam();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create invite');
      }
    } catch {
      alert('Error creating invite');
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    const actionText = user.active ? 'deactivate' : 'reactivate';
    const warning = user.active ? '\nThis will immediately terminate all active login sessions for this user.' : '';
    if (!confirm(`Are you sure you want to ${actionText} ${user.name}?${warning}`)) {
      return;
    }

    try {
      const res = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          active: !user.active,
        }),
      });
      if (res.ok) {
        fetchTeam();
      }
    } catch {
      // Ignored
    }
  };

  const handleOpenOverrides = (u: StaffUserWithPerms) => {
    setSelectedStaff(u);
    setEditingCustomPerms(u.customPerms || []);
    setEditingDeniedPerms(u.deniedPerms || []);
  };

  const handleSaveOverrides = async () => {
    if (!selectedStaff) return;
    setSavingOverrides(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          customPerms: editingCustomPerms,
          deniedPerms: editingDeniedPerms,
        }),
      });
      if (res.ok) {
        setSelectedStaff(null);
        await fetchTeam();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save permission overrides');
      }
    } catch {
      alert('Error updating user overrides');
    } finally {
      setSavingOverrides(false);
    }
  };

  const inviteUrl = createdInviteToken
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://brewns.pk'}/invite/${createdInviteToken}`
    : '';

  const isOwner = currentUserRole === 'owner';
  const allPermsList = Object.entries(PERMISSIONS) as [Permission, (typeof PERMISSIONS)[keyof typeof PERMISSIONS]][];

  return (
    <div>
      <div className="co-page-title" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Staff &amp; Access Roster</h1>
          <p>Multi-branch staff directory, role governance, session kill switch, and per-user permission overrides.</p>
        </div>

        <div>
          <button
            type="button"
            className="btn-co btn-co-primary"
            onClick={() => {
              setCreatedInviteToken(null);
              setShowInviteModal(true);
            }}
          >
            + Invite Team Member
          </button>
        </div>
      </div>

      {/* Staff List Table */}
      <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', overflowX: 'auto', marginBottom: '32px' }}>
        <table className="co-table">
          <thead>
            <tr>
              <th>NAME &amp; CONTACT</th>
              <th>ROLE &amp; BADGE</th>
              <th>ASSIGNED BRANCHES</th>
              <th>CUSTOM PERMISSIONS</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => {
              const roleMeta = ROLE_INFO[u.role] || { label: u.role, color: 'var(--co-cream)', badge: '' };
              const customCount = (u.customPerms || []).length;
              const deniedCount = (u.deniedPerms || []).length;

              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                      {u.email} · {u.phone}
                    </div>
                    {u.riderPlate && (
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--co-blue)', marginTop: '2px' }}>
                        🛵 Motorbike: {u.riderPlate}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${roleMeta.color}`,
                        color: roleMeta.color,
                      }}
                    >
                      {roleMeta.badge} {roleMeta.label.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>
                    {u.shops.length === 0 || u.shops.length === 3 ? (
                      <span style={{ color: 'var(--co-amber-light)', fontWeight: 600 }}>All Branches (Enterprise)</span>
                    ) : (
                      u.shops.map((s) => (
                        <span
                          key={s}
                          style={{
                            display: 'inline-block',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            marginRight: '4px',
                          }}
                        >
                          {LOC_TITLES[s] || LOCS[s]?.[0]}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    {u.role === 'owner' ? (
                      <span style={{ fontSize: '11px', color: 'var(--co-amber-light)', fontWeight: 600 }}>
                        👑 Full Root (All)
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {customCount > 0 && (
                          <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            +{customCount} grants
                          </span>
                        )}
                        {deniedCount > 0 && (
                          <span style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            −{deniedCount} denied
                          </span>
                        )}
                        {customCount === 0 && deniedCount === 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                            Standard Role Default
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: u.active ? '#4ADE80' : '#F87171',
                      }}
                    >
                      {u.active ? '● ACTIVE' : '○ SUSPENDED'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isOwner && u.role !== 'owner' && (
                        <button
                          type="button"
                          className="btn-co btn-co-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenOverrides(u)}
                          title="Grant or restrict specific permissions for this employee"
                        >
                          Overrides
                        </button>
                      )}

                      {u.role !== 'owner' && (
                        <button
                          type="button"
                          className={`btn-co ${u.active ? 'btn-co-danger' : 'btn-co-secondary'}`}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.active ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Individual Custom Permission Overrides Modal */}
      {selectedStaff && (
        <div className="co-drawer-overlay" onClick={() => setSelectedStaff(null)}>
          <div
            style={{
              background: 'var(--co-panel)',
              border: '1px solid var(--co-border-strong)',
              borderRadius: '16px',
              padding: '28px',
              width: '680px',
              maxWidth: '92%',
              maxHeight: '85vh',
              overflowY: 'auto',
              margin: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  Custom Permission Overrides: {selectedStaff.name}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--co-cream-dim)' }}>
                  Role: <strong style={{ color: 'var(--co-amber-light)' }}>{ROLE_INFO[selectedStaff.role]?.label}</strong>. You can grant extra privileges or restrict specific actions.
                </p>
              </div>
              <button
                type="button"
                className="btn-co btn-co-secondary"
                style={{ padding: '4px 10px' }}
                onClick={() => setSelectedStaff(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {PERMISSION_GROUPS.map((grp) => {
                const groupPerms = allPermsList.filter(([, meta]) => meta.group === grp.id);
                return (
                  <div key={grp.id} style={{ background: 'var(--co-card)', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--co-amber-light)', marginBottom: '8px' }}>
                      {grp.icon} {grp.label.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {groupPerms.map(([pKey, pMeta]) => {
                        if (OWNER_ONLY.includes(pKey)) return null;

                        const isCustomGranted = editingCustomPerms.includes(pKey);
                        const isExplicitlyDenied = editingDeniedPerms.includes(pKey);

                        return (
                          <div
                            key={pKey}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '12px',
                              padding: '6px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600 }}>{pMeta.label}</div>
                              <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>{pMeta.desc}</div>
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '10px',
                                  fontFamily: 'monospace',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  border: '1px solid',
                                  background: isCustomGranted ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                                  borderColor: isCustomGranted ? '#4ADE80' : 'var(--co-border)',
                                  color: isCustomGranted ? '#4ADE80' : 'var(--co-cream-dim)',
                                }}
                                onClick={() => {
                                  if (isCustomGranted) {
                                    setEditingCustomPerms(editingCustomPerms.filter((p) => p !== pKey));
                                  } else {
                                    setEditingCustomPerms([...editingCustomPerms, pKey]);
                                    setEditingDeniedPerms(editingDeniedPerms.filter((p) => p !== pKey));
                                  }
                                }}
                              >
                                {isCustomGranted ? '✓ Extra Granted' : '+ Grant'}
                              </button>

                              <button
                                type="button"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '10px',
                                  fontFamily: 'monospace',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  border: '1px solid',
                                  background: isExplicitlyDenied ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                  borderColor: isExplicitlyDenied ? '#F87171' : 'var(--co-border)',
                                  color: isExplicitlyDenied ? '#F87171' : 'var(--co-cream-dim)',
                                }}
                                onClick={() => {
                                  if (isExplicitlyDenied) {
                                    setEditingDeniedPerms(editingDeniedPerms.filter((p) => p !== pKey));
                                  } else {
                                    setEditingDeniedPerms([...editingDeniedPerms, pKey]);
                                    setEditingCustomPerms(editingCustomPerms.filter((p) => p !== pKey));
                                  }
                                }}
                              >
                                {isExplicitlyDenied ? '⛔ Explicitly Denied' : '− Deny'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-co btn-co-secondary"
                onClick={() => setSelectedStaff(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-co btn-co-primary"
                onClick={handleSaveOverrides}
                disabled={savingOverrides}
              >
                {savingOverrides ? 'Applying...' : 'Save User Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="co-drawer-overlay" onClick={() => setShowInviteModal(false)}>
          <div
            style={{
              background: 'var(--co-panel)',
              border: '1px solid var(--co-border-strong)',
              borderRadius: '14px',
              padding: '28px',
              width: '460px',
              maxWidth: '90%',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>
              Invite Team Member
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '12px', color: 'var(--co-cream-dim)' }}>
              Generate an invite link with predefined role and shop assignments.
            </p>

            {!createdInviteToken ? (
              <form onSubmit={handleCreateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
                    ROLE
                  </label>
                  <select
                    className="co-input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                  >
                    {ROLES.filter((r) => r !== 'owner').map((r) => (
                      <option key={r} value={r}>
                        {ROLE_INFO[r].label} — {ROLE_INFO[r].blurb}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
                    PRIMARY SHOP LOCATION
                  </label>
                  <select
                    className="co-input"
                    value={inviteShop}
                    onChange={(e) => setInviteShop(Number(e.target.value))}
                  >
                    <option value={0}>MM Alam Road (Gulberg)</option>
                    <option value={1}>CCA, DHA Phase 5</option>
                    <option value={2}>Main Boulevard (Johar Town)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
                    EMAIL (OPTIONAL)
                  </label>
                  <input
                    className="co-input"
                    type="email"
                    placeholder="teammember@brewns.pk"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn-co btn-co-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowInviteModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-co btn-co-primary" style={{ flex: 1 }}>
                    Create Link
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--co-green)', marginBottom: '14px' }}>
                  ✓ Invitation link generated! Valid for 7 days.
                </p>

                <input
                  className="co-input"
                  readOnly
                  value={inviteUrl}
                  style={{ marginBottom: '14px', fontSize: '12px' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-co btn-co-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteUrl);
                      alert('Invitation link copied to clipboard!');
                    }}
                  >
                    Copy Link to Clipboard
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Join the Brewns team as ${ROLE_INFO[inviteRole].label}: ${inviteUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-co btn-co-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    Share via WhatsApp
                  </a>

                  <button
                    type="button"
                    className="btn-co btn-co-secondary"
                    onClick={() => setShowInviteModal(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
