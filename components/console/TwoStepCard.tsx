'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, pkDate, pkTime } from './api';
import { useRun } from './Toasts';

type Status = { enabled: boolean; pending: boolean; since: number; recoveryLeft: number; lastLoginAt: number; events: { t: number; action: string; detail: string }[] };
type Setup = { key: string; uri: string; qr: string };
type Step = 'idle' | 'ask-start' | 'scan' | 'codes' | 'ask-off' | 'ask-new';

const tell = (on: boolean) => window.dispatchEvent(new CustomEvent('brewns:two-step', { detail: { on } }));

/** Two-step sign-in for your own account, and your recent sign-in activity. */
export function TwoStepCard() {
  const run = useRun();
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Status>('/api/staff/two-step').then(setStatus).catch(() => {}), []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const reset = () => {
    setStep('idle');
    setSetup(null);
    setPassword('');
    setCode('');
  };

  const start = async () => {
    setBusy(true);
    const r = await run(() => api<Setup>('/api/staff/two-step', { action: 'start', password }));
    setBusy(false);
    if (!r) return;
    setSetup(r);
    setPassword('');
    setStep('scan');
  };

  const confirm = async () => {
    setBusy(true);
    const r = await run(() => api<{ recovery: string[] }>('/api/staff/two-step', { action: 'confirm', code }));
    setBusy(false);
    if (!r) return;
    setCodes(r.recovery);
    setSetup(null);
    setCode('');
    setStep('codes');
    tell(true);
    void load();
  };

  const off = async () => {
    setBusy(true);
    const r = await run(() => api('/api/staff/two-step', { action: 'disable', password, code }), 'Two-step sign-in is off.');
    setBusy(false);
    if (!r) return;
    reset();
    tell(false);
    void load();
  };

  const regenerate = async () => {
    setBusy(true);
    const r = await run(() => api<{ recovery: string[] }>('/api/staff/two-step', { action: 'recovery', password, code }));
    setBusy(false);
    if (!r) return;
    setCodes(r.recovery);
    setPassword('');
    setCode('');
    setStep('codes');
    void load();
  };

  const copy = () => navigator.clipboard?.writeText(codes.join('\n')).then(() => run(async () => true, 'Recovery codes copied.'));
  const save = () => {
    const url = URL.createObjectURL(new Blob([`brewns two-step recovery codes\nEach works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brewns-recovery-codes.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="cx-card cx-stack" style={{ gap: 14 }} aria-labelledby="two-step-h">
      <div className="cx-row between" style={{ flexWrap: 'nowrap' }}>
        <div>
          <p className="cx-h2" id="two-step-h" style={{ margin: 0 }}>
            Two-step sign-in
          </p>
          <p className="cx-small cx-muted" style={{ margin: '2px 0 0' }}>
            A code from your phone as well as your password, so a stolen password alone is not enough.
          </p>
        </div>
        <span className={`cx-pill ${status?.enabled ? 'ready' : ''}`} style={{ flex: 'none' }}>
          {!status ? '…' : status.enabled ? 'On' : 'Off'}
        </span>
      </div>

      {step === 'idle' && status && !status.enabled && (
        <button type="button" className="cx-btn primary" onClick={() => setStep('ask-start')}>
          Turn on two-step sign-in
        </button>
      )}

      {step === 'idle' && status?.enabled && (
        <div className="cx-stack" style={{ gap: 10 }}>
          <p className="cx-small">
            On since {pkDate(status.since)}. {status.recoveryLeft} recovery code{status.recoveryLeft === 1 ? '' : 's'} left
            {status.recoveryLeft <= 2 ? ' · make new ones soon' : ''}.
          </p>
          <div className="cx-row">
            <button type="button" className="cx-btn sm" onClick={() => setStep('ask-new')}>
              New recovery codes
            </button>
            <button type="button" className="cx-btn sm danger" onClick={() => setStep('ask-off')}>
              Turn off
            </button>
          </div>
        </div>
      )}

      {step === 'ask-start' && (
        <form
          className="cx-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <label className="cx-field">
            <span>Your password, to make sure it&apos;s you</span>
            <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <div className="cx-row">
            <button className="cx-btn primary" disabled={!password || busy}>
              Continue
            </button>
            <button type="button" className="cx-btn" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === 'scan' && setup && (
        <form
          className="cx-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <ol className="cx-small" style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…).</li>
            <li>Scan this code, or choose &quot;enter a setup key&quot; and type the key below.</li>
            <li>Type the 6-digit code it shows.</li>
          </ol>
          <div className="cx-row" style={{ alignItems: 'center', gap: 16 }}>
            <div className="cx-qr" aria-label="Setup QR code" role="img" dangerouslySetInnerHTML={{ __html: setup.qr }} />
            <div className="cx-stack" style={{ gap: 4 }}>
              <span className="cx-small cx-muted">Setup key</span>
              <code className="cx-mono" style={{ fontSize: 14, letterSpacing: '0.05em', wordBreak: 'break-all' }}>
                {setup.key}
              </code>
            </div>
          </div>
          <label className="cx-field">
            <span>6-digit code</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" />
          </label>
          <div className="cx-row">
            <button className="cx-btn primary" disabled={code.replace(/\D/g, '').length !== 6 || busy}>
              Turn on
            </button>
            <button type="button" className="cx-btn" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className="cx-stack" style={{ gap: 10 }}>
          <p className="cx-banner" role="status" style={{ margin: 0 }}>
            Save these recovery codes now. Each works once if you lose your phone, and they will not be shown again.
          </p>
          <ul className="cx-codes" aria-label="Recovery codes">
            {codes.map((c) => (
              <li key={c} className="cx-mono">
                {c}
              </li>
            ))}
          </ul>
          <div className="cx-row">
            <button type="button" className="cx-btn sm" onClick={() => void copy()}>
              Copy
            </button>
            <button type="button" className="cx-btn sm" onClick={save}>
              Download
            </button>
            <button type="button" className="cx-btn sm primary" onClick={reset}>
              I&apos;ve saved them
            </button>
          </div>
        </div>
      )}

      {(step === 'ask-off' || step === 'ask-new') && (
        <form
          className="cx-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void (step === 'ask-off' ? off() : regenerate());
          }}
        >
          <label className="cx-field">
            <span>Your password</span>
            <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="cx-field">
            <span>A current code from your app, or a recovery code</span>
            <input autoComplete="one-time-code" maxLength={24} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="cx-row">
            <button className={`cx-btn ${step === 'ask-off' ? 'danger' : 'primary'}`} disabled={!password || !code.trim() || busy}>
              {step === 'ask-off' ? 'Turn off two-step' : 'Make new codes'}
            </button>
            <button type="button" className="cx-btn" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {status && status.events.length > 0 && (
        <>
          <div className="cx-divider" />
          <div>
            <p className="cx-h2" style={{ marginBottom: 8 }}>
              Recent sign-in activity
            </p>
            <ul className="cx-stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
              {status.events.map((e, i) => (
                <li key={`${e.t}:${i}`} className="cx-row between" style={{ flexWrap: 'nowrap', gap: 12 }}>
                  <span className="cx-small">
                    {e.action}
                    {e.detail ? <span className="cx-faint"> · {e.detail}</span> : null}
                  </span>
                  <span className="cx-small cx-muted" style={{ flex: 'none' }}>
                    {pkDate(e.t)} {pkTime(e.t)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="cx-small cx-faint" style={{ marginTop: 8 }}>
              Not you? Change your password and tell the owner.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
