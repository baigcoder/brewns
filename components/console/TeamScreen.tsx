'use client';

import { useEffect, useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { outranks, ROLE_INFO, ROLES, type Role } from '@/lib/rbac';
import { ago, api, initials, useNow } from './api';
import { useMe } from './Shell';
import { useRun, useToast } from './Toasts';

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  plate: string;
  role: Role;
  shops: number[];
  active: boolean;
  createdAt: number;
  lastLoginAt: number;
  lastSeenAt: number;
  invited: boolean;
  inviteExpired: boolean;
  invitedBy: string;
};

const shopsLabel = (s: number[]) => (s.length ? s.map((i) => LOC_TITLES[i].split(',')[0]).join(', ') : 'All shops');

export function TeamScreen() {
  const { me, can } = useMe();
  const run = useRun();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [edit, setEdit] = useState<Member | 'new' | null>(null);
  const [link, setLink] = useState<{ name: string; url: string; reset: boolean } | null>(null);
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const load = () => run(() => api<{ team: Member[] }>('/api/staff/users')).then((r) => r && setTeam(r.team));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const manage = can('staff.manage');
  const canEdit = (m: Member) => manage && (m.id === me.id || outranks(me.role, m.role));
  const list = (team || []).filter((m) => filter === 'all' || m.role === filter);
  const now = useNow(30000);

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {team ? `${team.filter((m) => m.active && !m.invited).length} active · ${team.filter((m) => m.invited).length} invited` : 'Loading…'}
          </p>
          <h1 className="cx-h1">Team</h1>
        </div>
        {manage && (
          <button type="button" className="cx-btn primary" onClick={() => setEdit('new')}>
            + Invite someone
          </button>
        )}
      </div>
      <div className="cx-seg" role="group" aria-label="Role" style={{ marginBottom: 14 }}>
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Everyone
        </button>
        {ROLES.map((r) => (
          <button type="button" key={r} aria-pressed={filter === r} onClick={() => setFilter(r)}>
            {ROLE_INFO[r].label}s
          </button>
        ))}
      </div>

      {link && (
        <div className="cx-card cx-stack" style={{ marginBottom: 16, borderColor: 'var(--cx-accent)' }}>
          <p className="cx-h2">{link.reset ? `A new password link for ${link.name}` : `Send ${link.name} their invite`}</p>
          <p className="cx-small cx-muted">This link works once and for 7 days. Anyone with it can set the password, so send it only to them.</p>
          <div className="cx-row">
            <input className="cx-input cx-mono" readOnly value={link.url} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 240 }} aria-label="Invite link" />
            <CopyButton text={link.url} />
            <a className="cx-btn" target="_blank" rel="noopener" href={`https://wa.me/?text=${encodeURIComponent(`Salam ${link.name.split(' ')[0]}! ${link.reset ? 'Set a new password' : 'Join the brewns console'} here: ${link.url}`)}`}>
              WhatsApp
            </a>
            <button type="button" className="cx-btn ghost" onClick={() => setLink(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {!team ? (
        <p className="cx-empty">Loading…</p>
      ) : (
        <div className="cx-table-wrap">
          <table className="cx-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Shops</th>
                <th>Status</th>
                <th>Last seen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                  <td>
                    <div className="cx-row" style={{ flexWrap: 'nowrap' }}>
                      <span className="cx-avatar">{initials(m.name)}</span>
                      <div>
                        <p style={{ fontWeight: 600 }}>
                          {m.name}
                          {m.id === me.id ? <span className="cx-muted"> (you)</span> : null}
                        </p>
                        <p className="cx-small cx-muted">
                          {m.email}
                          {m.plate ? ` · ${m.plate}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{ROLE_INFO[m.role].label}</td>
                  <td className="cx-muted">{shopsLabel(m.shops)}</td>
                  <td>
                    {!m.active ? (
                      <span className="cx-pill cancelled">Switched off</span>
                    ) : m.invited && !m.lastLoginAt ? (
                      <span className={`cx-pill ${m.inviteExpired ? 'cancelled' : 'received'}`}>{m.inviteExpired ? 'Invite expired' : 'Invited'}</span>
                    ) : now - m.lastSeenAt < 10 * 60000 ? (
                      <span className="cx-pill ready">Online</span>
                    ) : (
                      <span className="cx-pill plain">Active</span>
                    )}
                  </td>
                  <td className="cx-small cx-muted">{m.lastSeenAt ? ago(m.lastSeenAt, now) : '—'}</td>
                  <td className="r">
                    {canEdit(m) && (
                      <button type="button" className="cx-btn sm" onClick={() => setEdit(m)}>
                        Manage
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="cx-grid three" style={{ marginTop: 22 }}>
        {ROLES.map((r) => (
          <div key={r} className="cx-card">
            <p className="cx-h2">{ROLE_INFO[r].label}</p>
            <p className="cx-small cx-muted">{ROLE_INFO[r].blurb}</p>
          </div>
        ))}
      </section>

      {edit && (
        <MemberForm
          member={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={(r) => {
            setEdit(null);
            if (r.link) setLink(r.link);
            load();
          }}
        />
      )}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="cx-btn primary"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(
          () => toast('Link copied.', 'good'),
          () => toast('Select the link and copy it.', 'bad'),
        )
      }
    >
      Copy
    </button>
  );
}

function MemberForm({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: (r: { link?: { name: string; url: string; reset: boolean } }) => void }) {
  const { me } = useMe();
  const run = useRun();
  const self = member?.id === me.id;
  const myShops = me.shops.length ? me.shops : LOC_TITLES.map((_, i) => i);
  const roles = ROLES.filter((r) => me.role === 'owner' || outranks(me.role, r));
  const [f, setF] = useState({
    name: member?.name || '',
    email: member?.email || '',
    phone: member?.phone || '',
    plate: member?.plate || '',
    role: (member?.role || (roles.includes('waiter') ? 'waiter' : roles[0])) as Role,
    shops: member?.shops || (me.shops.length ? me.shops : []),
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    if (!member) {
      const r = await run(() => api<{ link: string }>('/api/staff/users', f), `${f.name} is invited.`);
      setBusy(false);
      if (r) onSaved({ link: { name: f.name, url: r.link, reset: false } });
      return;
    }
    const body: Record<string, unknown> = { name: f.name, phone: f.phone, plate: f.plate };
    if (!self) {
      body.role = f.role;
      body.shops = f.shops;
    } else if (me.role === 'owner') body.shops = f.shops;
    const r = await run(() => api(`/api/staff/users/${member.id}`, body), 'Saved.');
    setBusy(false);
    if (r) onSaved({});
  };
  const action = async (body: Record<string, unknown>, done: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    const r = await run(() => api<{ link: string }>(`/api/staff/users/${member!.id}`, body), done);
    if (r) onSaved(r.link ? { link: { name: member!.name, url: r.link, reset: !!member!.lastLoginAt } } : {});
  };

  return (
    <div className="cx-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cx-modal" role="dialog" aria-modal="true" aria-label={member ? `Manage ${member.name}` : 'Invite someone'}>
        <div className="cx-row between">
          <h2 className="cx-h1" style={{ fontSize: 24 }}>
            {member ? member.name : 'Invite someone'}
          </h2>
          <button type="button" className="cx-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="cx-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="cx-field">
            <span>Name</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} />
          </label>
          <label className="cx-field">
            <span>Email {member ? '' : '· they sign in with it'}</span>
            <input type="email" value={f.email} disabled={!!member} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={120} />
          </label>
          <label className="cx-field">
            <span>Mobile · optional</span>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={20} />
          </label>
          {f.role === 'rider' && (
            <label className="cx-field">
              <span>Bike plate</span>
              <input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} maxLength={20} placeholder="LEB 21 4471" />
            </label>
          )}
        </div>
        <label className="cx-field">
          <span>Role{self ? ' · another owner can change yours' : ''}</span>
          <select value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(self ? [f.role] : roles).map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label} — {ROLE_INFO[r].blurb}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="cx-stack" style={{ gap: 8 }} disabled={self && me.role !== 'owner'}>
          <legend className="cx-eyebrow" style={{ marginBottom: 8 }}>
            Works at
          </legend>
          <div className="cx-row">
            {!me.shops.length && (
              <label className="cx-check">
                <input type="checkbox" checked={!f.shops.length} onChange={() => setF({ ...f, shops: f.shops.length ? [] : [0] })} />
                All shops
              </label>
            )}
            {myShops.map((i) => (
              <label className="cx-check" key={i}>
                <input type="checkbox" checked={f.shops.includes(i)} onChange={(e) => setF({ ...f, shops: e.target.checked ? [...f.shops, i].sort() : f.shops.filter((x) => x !== i) })} />
                {LOC_TITLES[i].split(',')[0]}
              </label>
            ))}
          </div>
          <p className="cx-small cx-muted">They only see orders, tables and deliveries at these shops.</p>
        </fieldset>
        <button type="button" className="cx-btn primary big" disabled={busy || f.name.trim().length < 2 || (!member && !f.email.includes('@'))} onClick={submit}>
          {member ? 'Save' : 'Create the invite link'}
        </button>

        {member && !self && (
          <div className="cx-stack">
            <div className="cx-divider" />
            <div className="cx-row">
              {member.active && (
                <button type="button" className="cx-btn sm" onClick={() => action({ reset: true }, 'New link ready.')}>
                  {member.lastLoginAt ? 'New password link' : 'New invite link'}
                </button>
              )}
              {member.lastLoginAt > 0 && (
                <button type="button" className="cx-btn sm" onClick={() => action({ signout: true }, 'Signed out on every device.')}>
                  Sign out everywhere
                </button>
              )}
              {member.lastLoginAt ? (
                <button
                  type="button"
                  className={`cx-btn sm${member.active ? ' danger' : ''}`}
                  onClick={() => action({ active: !member.active }, member.active ? `${member.name} is switched off and signed out.` : `${member.name} can sign in again.`, member.active ? `Switch off ${member.name}? They are signed out at once and can't sign in until switched back on. Their history stays.` : undefined)}
                >
                  {member.active ? 'Switch off' : 'Switch on'}
                </button>
              ) : (
                <button type="button" className="cx-btn sm danger" onClick={() => action({ remove: true }, 'Invite withdrawn.', `Withdraw the invite for ${member.name}?`)}>
                  Withdraw invite
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
