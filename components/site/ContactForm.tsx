'use client';

import { type FormEvent, useState } from 'react';
import { CAFE_EMAIL, CAFES } from '@/lib/locations';

const TOPICS = ['A question', 'Feedback on a visit', 'An order', 'Events & catering', 'Wholesale beans', 'Working at brewns'];

/**
 * Writes the message into the visitor's own email app, addressed to the café.
 * Nothing is sent from the page, so there is no inbox to spam and no data kept.
 */
export function ContactForm() {
  const [err, setErr] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') || '').trim();
    const message = String(f.get('message') || '').trim();
    if (!name || message.length < 5) return setErr('Add your name and a short message.');
    setErr('');
    const subject = `${f.get('topic')} · ${name}`;
    const body = `${message}\n\nCounter: ${f.get('cafe')}\n— ${name}`;
    window.location.href = `mailto:${CAFE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return (
    <form className="ip-form" onSubmit={submit} noValidate>
      <label>
        Your name
        <input name="name" autoComplete="name" maxLength={60} required />
      </label>
      <label>
        What it&apos;s about
        <select name="topic" defaultValue={TOPICS[0]}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Counter
        <select name="cafe" defaultValue="Any">
          <option>Any</option>
          {CAFES.map((c) => (
            <option key={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        Message
        <textarea name="message" maxLength={2000} required />
      </label>
      {err ? (
        <p className="ip-form-err" role="alert">
          {err}
        </p>
      ) : null}
      <button type="submit" className="ip-btn">
        Write the email →
      </button>
      <p className="ip-form-note">Opens your email app with the message ready to send to {CAFE_EMAIL}.</p>
    </form>
  );
}
