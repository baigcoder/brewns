'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ALL_PERMISSIONS, OWNER_ONLY, PERMISSIONS, ROLE_INFO, ROLES, type Permission, type Role, type RolePerms } from '@/lib/rbac';
import { api } from './api';
import { useLive } from './Live';
import { useRun } from './Toasts';

/**
 * The owner's control panel for roles: every permission down the side, every
 * role across the top. Real-time synchronized across all active devices.
 * A toggle takes effect on that role's open browser tabs instantly.
 * Owners always have everything; access control itself stays with owners.
 */
export function AccessScreen() {
  const run = useRun();
  const { data } = useLive();
  const [perms, setPerms] = useState<RolePerms | null>(null);
  const [defaults, setDefaults] = useState<RolePerms | null>(null);
  const [busy, setBusy] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Initial fetch of matrix and defaults
  useEffect(() => {
    run(() => api<{ rolePerms: RolePerms; defaults: RolePerms }>('/api/staff/access')).then((r) => {
      if (!r) return;
      setPerms(r.rolePerms);
      setDefaults(r.defaults);
    });
  }, [run]);

  // Real-time synchronization from live poll / socket stream
  useEffect(() => {
    if (data?.rolePerms) {
      setPerms(data.rolePerms);
    }
  }, [data?.rolePerms]);

  const toggle = async (role: Role, perm: Permission, on: boolean) => {
    if (!perms) return;
    setBusy(`${role}:${perm}`);

    // Optimistic UI update for instantaneous responsiveness
    const prevPerms = perms;
    const nextList = new Set(perms[role]);
    if (on) nextList.add(perm);
    else nextList.delete(perm);
    setPerms({ ...perms, [role]: [...nextList] });

    try {
      const r = await run(
        () => api<{ rolePerms: RolePerms }>('/api/staff/access', { role, perm, on }),
        `${ROLE_INFO[role].label}s ${on ? 'can now' : 'can no longer'}: ${PERMISSIONS[perm].label.toLowerCase()}.`,
      );
      if (r) setPerms(r.rolePerms);
      else setPerms(prevPerms);
    } catch {
      setPerms(prevPerms);
    } finally {
      setBusy('');
    }
  };

  const reset = async (role: Role) => {
    const r = await run(
      () => api<{ rolePerms: RolePerms }>('/api/staff/access', { reset: role }),
      `${ROLE_INFO[role].label}s are back to default permissions.`,
    );
    if (r) setPerms(r.rolePerms);
  };

  const changed = (role: Role) => !!perms && !!defaults && [...perms[role]].sort().join() !== [...defaults[role]].sort().join();
  const groups = useMemo(() => [...new Set(ALL_PERMISSIONS.map((p) => PERMISSIONS[p].group))], []);

  // Filter permissions based on user search and group selection
  const filteredPermissions = useMemo(() => {
    const s = search.trim().toLowerCase();
    return ALL_PERMISSIONS.filter((p) => {
      const info = PERMISSIONS[p];
      const matchGroup = selectedGroup === 'all' || info.group === selectedGroup;
      const matchSearch = !s || info.label.toLowerCase().includes(s) || info.desc.toLowerCase().includes(s) || p.toLowerCase().includes(s);
      return matchGroup && matchSearch;
    });
  }, [search, selectedGroup]);

  const activeGroups = useMemo(() => {
    const set = new Set(filteredPermissions.map((p) => PERMISSIONS[p].group));
    return groups.filter((g) => set.has(g));
  }, [filteredPermissions, groups]);

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p className="cx-eyebrow" style={{ margin: 0 }}>
              <b>{'//'}</b> Owners only
            </p>
            <span className="cx-live-tag" title="Changes sync live across all staff screens">
              ● REALTIME RBAC ACTIVE
            </span>
          </div>
          <h1 className="cx-h1">Access Control</h1>
        </div>
        <p className="cx-small cx-muted" style={{ maxWidth: 460 }}>
          What each role can see and do in real-time. Toggling a permission broadcasts immediately to all active screens without refreshing. Where someone works (shops) is set per person on the Team page.
        </p>
      </div>

      {/* Role Stats Ribbon */}
      {perms && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: 16,
          }}
        >
          {ROLES.map((r) => {
            const count = perms[r]?.length || 0;
            const total = ALL_PERMISSIONS.length;
            const isDiff = changed(r);
            return (
              <div
                key={r}
                className="cx-card"
                style={{
                  padding: '10px 14px',
                  minWidth: 125,
                  flex: '0 0 auto',
                  background: 'var(--cx-panel-2)',
                  borderColor: isDiff ? 'var(--cx-accent)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span className="cx-eyebrow" style={{ color: r === 'owner' ? 'var(--cx-accent)' : undefined }}>
                    {ROLE_INFO[r].label}
                  </span>
                  {isDiff && (
                    <span style={{ fontSize: 9, color: 'var(--cx-accent)', fontWeight: 700 }}>MODIFIED</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-space-mono)' }}>
                    {count}
                  </span>
                  <span className="cx-faint cx-small">/ {total} perms</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div className="cx-seg" role="group" aria-label="Permission Category Filter">
          <button type="button" aria-pressed={selectedGroup === 'all'} onClick={() => setSelectedGroup('all')}>
            All ({ALL_PERMISSIONS.length})
          </button>
          {groups.map((g) => {
            const count = ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].group === g).length;
            return (
              <button type="button" key={g} aria-pressed={selectedGroup === g} onClick={() => setSelectedGroup(g)}>
                {g} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="search"
            className="cx-input"
            placeholder="Filter permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200, height: 32, fontSize: 12 }}
            aria-label="Filter permissions"
          />
          {search && (
            <button type="button" className="cx-btn sm ghost" onClick={() => setSearch('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      {!perms ? (
        <p className="cx-empty">Loading role matrix…</p>
      ) : filteredPermissions.length === 0 ? (
        <div className="cx-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <p className="cx-muted">No permissions match &ldquo;{search}&rdquo;.</p>
          <button type="button" className="cx-btn sm" onClick={() => { setSearch(''); setSelectedGroup('all'); }} style={{ marginTop: 8 }}>
            Show all permissions
          </button>
        </div>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table cx-matrix">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Permission</th>
                {ROLES.map((r) => (
                  <th key={r} style={{ textAlign: 'center', minWidth: 90 }}>
                    <span style={{ fontWeight: 700, color: r === 'owner' ? 'var(--cx-accent)' : undefined }}>
                      {ROLE_INFO[r].label}
                    </span>
                    {r !== 'owner' && changed(r) && (
                      <div style={{ marginTop: 4 }}>
                        <button
                          type="button"
                          className="cx-link cx-small"
                          onClick={() => reset(r)}
                          style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}
                          title="Reset role to default permissions"
                        >
                          reset
                        </button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeGroups.map((g) => (
                <Fragment key={g}>
                  <tr className="group">
                    <td colSpan={ROLES.length + 1}>
                      <span className="cx-matrix-group">{g}</span>
                    </td>
                  </tr>
                  {filteredPermissions
                    .filter((p) => PERMISSIONS[p].group === g)
                    .map((p) => (
                      <tr key={p}>
                        <td>
                          <p style={{ fontWeight: 600, margin: 0 }}>{PERMISSIONS[p].label}</p>
                          <p className="cx-small cx-muted" style={{ margin: '2px 0 0' }}>{PERMISSIONS[p].desc}</p>
                        </td>
                        {ROLES.map((r) => {
                          const locked = r === 'owner' || OWNER_ONLY.includes(p);
                          const on = r === 'owner' || perms[r].includes(p);
                          const isBusyThis = busy === `${r}:${p}`;
                          return (
                            <td key={r} style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={locked || isBusyThis}
                                onChange={(e) => toggle(r, p, e.target.checked)}
                                aria-label={`${ROLE_INFO[r].label}: ${PERMISSIONS[p].label}`}
                                title={
                                  r === 'owner'
                                    ? 'Owners can always do everything'
                                    : OWNER_ONLY.includes(p)
                                    ? 'Stays with owners only'
                                    : `${on ? 'Revoke' : 'Grant'} ${PERMISSIONS[p].label} for ${ROLE_INFO[r].label}s`
                                }
                                style={{
                                  cursor: locked ? 'not-allowed' : 'pointer',
                                  transform: isBusyThis ? 'scale(1.2)' : undefined,
                                  transition: 'transform 120ms',
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
