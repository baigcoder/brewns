'use client';

import { Fragment, useEffect, useState } from 'react';
import { ALL_PERMISSIONS, OWNER_ONLY, PERMISSIONS, ROLE_INFO, ROLES, type Permission, type Role, type RolePerms } from '@/lib/rbac';
import { api } from './api';
import { useRun } from './Toasts';

/**
 * The owner's control panel for roles: every permission down the side, every
 * role across the top. A tick takes effect on that role's very next click.
 * Owners always have everything; access control itself stays with owners.
 */
export function AccessScreen() {
  const run = useRun();
  const [perms, setPerms] = useState<RolePerms | null>(null);
  const [defaults, setDefaults] = useState<RolePerms | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    run(() => api<{ rolePerms: RolePerms; defaults: RolePerms }>('/api/staff/access')).then((r) => {
      if (!r) return;
      setPerms(r.rolePerms);
      setDefaults(r.defaults);
    });
  }, [run]);

  const toggle = async (role: Role, perm: Permission, on: boolean) => {
    setBusy(`${role}:${perm}`);
    const r = await run(() => api<{ rolePerms: RolePerms }>('/api/staff/access', { role, perm, on }), `${ROLE_INFO[role].label}s ${on ? 'can now' : 'can no longer'}: ${PERMISSIONS[perm].label.toLowerCase()}.`);
    if (r) setPerms(r.rolePerms);
    setBusy('');
  };
  const reset = async (role: Role) => {
    const r = await run(() => api<{ rolePerms: RolePerms }>('/api/staff/access', { reset: role }), `${ROLE_INFO[role].label}s are back to the defaults.`);
    if (r) setPerms(r.rolePerms);
  };
  const changed = (role: Role) => !!perms && !!defaults && [...perms[role]].sort().join() !== [...defaults[role]].sort().join();
  const groups = [...new Set(ALL_PERMISSIONS.map((p) => PERMISSIONS[p].group))];

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> Owners only
          </p>
          <h1 className="cx-h1">Access</h1>
        </div>
        <p className="cx-small cx-muted" style={{ maxWidth: 440 }}>
          What each role can see and do. Changes apply on their next click, on every device. Where someone works (which shops) is set per person on the Team page.
        </p>
      </div>
      {!perms ? (
        <p className="cx-empty">Loading…</p>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table cx-matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {ROLES.map((r) => (
                  <th key={r}>
                    {ROLE_INFO[r].label}
                    {r !== 'owner' && changed(r) && (
                      <>
                        <br />
                        <button type="button" className="cx-link cx-small" onClick={() => reset(r)} style={{ textTransform: 'none', letterSpacing: 0 }}>
                          reset
                        </button>
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="group">
                    <td colSpan={ROLES.length + 1}>{g}</td>
                  </tr>
                  {ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].group === g).map((p) => (
                    <tr key={p}>
                      <td>
                        <p style={{ fontWeight: 600 }}>{PERMISSIONS[p].label}</p>
                        <p className="cx-small cx-muted">{PERMISSIONS[p].desc}</p>
                      </td>
                      {ROLES.map((r) => {
                        const locked = r === 'owner' || OWNER_ONLY.includes(p);
                        const on = r === 'owner' || perms[r].includes(p);
                        return (
                          <td key={r}>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={locked || busy === `${r}:${p}`}
                              onChange={(e) => toggle(r, p, e.target.checked)}
                              aria-label={`${ROLE_INFO[r].label}: ${PERMISSIONS[p].label}`}
                              title={r === 'owner' ? 'Owners can always do everything' : OWNER_ONLY.includes(p) ? 'Stays with owners' : undefined}
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
