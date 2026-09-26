'use client';

import { useState, type ReactNode } from 'react';

export type Field = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; value?: string; hint?: string; required?: boolean; maxLength?: number; readOnly?: boolean };

/**
 * A sign-in style form: posts its fields as JSON to `action` (plus `extra`),
 * shows the server's sentence if it says no, and goes where it says on yes.
 */
export function AuthForm({ eyebrow, heading, fields, action, extra, submit, footer, withClub }: { eyebrow: string; heading: string; fields: Field[]; action: string; extra?: Record<string, unknown>; submit: string; footer?: ReactNode; withClub?: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const body: Record<string, unknown> = { ...Object.fromEntries(new FormData(e.currentTarget)), ...extra };
        const next = new URLSearchParams(location.search).get('next');
        if (next) body.next = next;
        // A club card kept on this phone comes along into a new account.
        if (withClub) {
          try {
            const card = JSON.parse(localStorage.getItem('brewns-club') || 'null');
            if (card?.member) body.club = card;
          } catch {}
        }
        try {
          const res = await fetch(action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
          window.location.assign(data.next || '/');
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <p className="cx-eyebrow">
        <b>{'//'}</b> {eyebrow}
      </p>
      <h2>{heading}</h2>
      {fields.map((f) => (
        <label key={f.name} className="cx-field">
          <span>{f.label}</span>
          <input name={f.name} type={f.type || 'text'} autoComplete={f.autoComplete} placeholder={f.placeholder} defaultValue={f.value} required={f.required !== false} maxLength={f.maxLength || 200} readOnly={f.readOnly} />
          {f.hint && <small className="cx-small cx-muted">{f.hint}</small>}
        </label>
      ))}
      {error && (
        <p className="auth-err" role="alert">
          {error}
        </p>
      )}
      <button className="cx-btn primary big block" disabled={busy}>
        {busy ? 'One moment…' : submit}
      </button>
      {footer && <div className="auth-alt">{footer}</div>}
    </form>
  );
}
