'use client';

import { useEffect, useState } from 'react';
import type { DirectMessage, DmThread } from '@/lib/server/directMessages';
import { ago, api, initials, pkTime, useNow } from './api';
import { useLive } from './Live';
import { useMe } from './Shell';
import { useRun } from './Toasts';

type Contact = { id: string; name: string; role: string };

/** Private one-to-one conversations with anyone at their shops. Refetched whenever the live version moves. */
export function DirectMessages() {
  const { me } = useMe();
  const { data } = useLive();
  const run = useRun();
  const now = useNow(30000);
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    api<{ threads: DmThread[]; contacts: Contact[]; messages?: DirectMessage[] }>(`/api/staff/dms${open ? `?with=${encodeURIComponent(open)}` : ''}`)
      .then((r) => {
        setThreads(r.threads);
        setContacts(r.contacts);
        setMessages(r.messages || []);
      })
      .catch(() => {});
  }, [open, data?.v]);

  const send = async () => {
    const r = await run(() => api<{ message: DirectMessage }>('/api/staff/dms', { to: open, text }));
    if (!r) return;
    setMessages((m) => [...m, r.message]);
    setText('');
  };

  const other = contacts.find((c) => c.id === open);
  const fresh = contacts.filter((c) => !threads.some((t) => t.with === c.id));

  return (
    <section className="cx-card cx-stack" style={{ gap: 12, marginBottom: 18 }}>
      <p className="cx-h2">Direct messages</p>
      <div className="cx-grid two">
        <div className="cx-stack" style={{ gap: 8 }}>
          {threads.map((t) => (
            <button key={t.with} type="button" className={`cx-btn${t.with === open ? ' primary' : ''}`} style={{ justifyContent: 'space-between', textAlign: 'left' }} onClick={() => setOpen(t.with)}>
              <span className="cx-row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                <span className="cx-avatar">{initials(t.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <b>{t.name}</b>
                  <span className="cx-small cx-muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.byId === me.id ? 'You: ' : ''}
                    {t.last} · {ago(t.at, now)}
                  </span>
                </span>
              </span>
              {t.unread > 0 && <span className="cx-badge alert">{t.unread}</span>}
            </button>
          ))}
          <label className="cx-field">
            <span>New conversation</span>
            <select className="cx-select" value="" onChange={(e) => e.target.value && setOpen(e.target.value)}>
              <option value="">{fresh.length ? 'Pick someone at your shops…' : 'No one else to message yet'}</option>
              {fresh.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.role}
                </option>
              ))}
            </select>
          </label>
        </div>

        {open ? (
          <div className="cx-stack" style={{ gap: 8 }}>
            <p style={{ fontWeight: 600 }}>
              {other?.name || threads.find((t) => t.with === open)?.name}
              {other && <span className="cx-small cx-muted"> · {other.role}</span>}
            </p>
            <div className="cx-chat" style={{ maxHeight: 360 }}>
              {messages.length ? (
                messages.map((m) => (
                  <div key={m.id} className={`cx-msg ${m.byId === me.id ? 'us' : 'them'}`} style={{ whiteSpace: 'pre-wrap' }}>
                    {m.text}
                    <small>{pkTime(m.at)}</small>
                  </div>
                ))
              ) : (
                <p className="cx-small cx-muted">No messages yet. Only the two of you see this conversation.</p>
              )}
            </div>
            <form
              className="cx-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) void send();
              }}
            >
              <input className="cx-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write a message…" aria-label="Message" />
              <button className="cx-btn primary">Send</button>
            </form>
          </div>
        ) : (
          <p className="cx-empty">Pick a conversation, or start one with anyone at your shops.</p>
        )}
      </div>
    </section>
  );
}
