'use client';

import { useEffect, useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import type { TeamMessage } from '@/lib/server/teamMessages';
import { ago, api, initials, useNow } from './api';
import { useLive } from './Live';
import { useMe } from './Shell';
import { useRun, useToast } from './Toasts';

const MAX = 1000;

/** Messages to the whole team: owners and managers write, everyone reads. */
export function MessagesScreen() {
  const { me, can } = useMe();
  const { refresh } = useLive();
  const run = useRun();
  const toast = useToast();
  const now = useNow(30000);
  const [messages, setMessages] = useState<TeamMessage[] | null>(null);
  const [text, setText] = useState('');
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const writer = can('staff.manage');

  useEffect(() => {
    api<{ messages: TeamMessage[] }>('/api/staff/messages')
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]));
    // opening the page reads them: the menu badge clears
    api('/api/staff/messages', { read: true })
      .then(() => refresh())
      .catch(() => {});
  }, [refresh]);

  const send = async () => {
    setBusy(true);
    const r = await run(() => api<{ message: TeamMessage; messages: TeamMessage[] }>('/api/staff/messages', { text, email }));
    setBusy(false);
    if (!r) return;
    setMessages(r.messages);
    setText('');
    setEmail(false);
    toast(r.message.emailed ? `Sent, and emailed to ${r.message.emailed} ${r.message.emailed === 1 ? 'person' : 'people'}.` : 'Sent to the team.', 'good');
  };

  return (
    <>
      <div className="cx-pagehead">
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> {writer ? (me.role === 'owner' || !me.shops.length ? 'To everyone on the team' : `To the team at ${me.shops.map((s) => LOC_TITLES[s]).join(', ')}`) : 'From the owner and managers'}
          </p>
          <h1 className="cx-h1">Team messages</h1>
        </div>
      </div>

      {writer && (
        <section className="cx-card cx-stack" style={{ gap: 12, marginBottom: 18 }}>
          <label className="cx-field">
            <span>
              New message · {text.length}/{MAX}
            </span>
            <textarea rows={4} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder="Team meeting Friday 9am at MM Alam. New winter menu starts Monday, please read the recipe cards." />
          </label>
          <label className="cx-row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
            <span className="cx-small">Also email a copy to everyone (for anything they must not miss)</span>
          </label>
          <button type="button" className="cx-btn primary" disabled={busy || text.trim().length < 2} onClick={send}>
            {busy ? (email ? 'Sending and emailing…' : 'Sending…') : 'Send to the team'}
          </button>
        </section>
      )}

      {!messages ? (
        <p className="cx-empty">Loading…</p>
      ) : !messages.length ? (
        <p className="cx-empty">No messages yet.{writer ? ' Anything you send here reaches everyone on the team.' : ' Messages from the owner and managers show up here.'}</p>
      ) : (
        <div className="cx-stack">
          {messages.map((m) => (
            <article key={m.id} className="cx-card cx-stack" style={{ gap: 8 }}>
              <div className="cx-row between">
                <div className="cx-row" style={{ flexWrap: 'nowrap' }}>
                  <span className="cx-avatar">{initials(m.by)}</span>
                  <div>
                    <p style={{ fontWeight: 600 }}>
                      {m.by}
                      {m.byId === me.id && <span className="cx-muted"> (you)</span>}
                    </p>
                    <p className="cx-small cx-muted">
                      {ROLE_INFO[m.role as Role]?.label || m.role}
                      {m.shops.length ? ` · to ${m.shops.map((s) => LOC_TITLES[s]).join(', ')}` : ' · to everyone'}
                      {m.emailed ? ` · emailed ${m.emailed}` : ''}
                    </p>
                  </div>
                </div>
                <time className="cx-small cx-muted" dateTime={new Date(m.at).toISOString()} title={new Date(m.at).toLocaleString('en-GB')}>
                  {ago(m.at, now)}
                </time>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{m.text}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
