'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Keep customer-facing details private; the digest links this event to server logs.
    console.error('[brewns render]', error.digest || 'client-render-error');
  }, [error]);

  return (
    <main style={styles.main}>
      <p style={styles.eyebrow}>BREWNS</p>
      <h1 style={styles.title}>Something went wrong.</h1>
      <p style={styles.copy}>Your order and account are safe. Please try again, or return to the café.</p>
      <div style={styles.actions}>
        <button type="button" onClick={() => retry()} style={styles.primary}>TRY AGAIN</button>
        <Link href="/" style={styles.secondary}>HOME</Link>
      </div>
    </main>
  );
}

const styles = {
  main: { minHeight: '100vh', display: 'grid', placeContent: 'center', gap: '1rem', padding: '2rem', background: '#100c0a', color: '#f5f0e8', textAlign: 'center' as const },
  eyebrow: { margin: 0, color: '#d58c3d', fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.16em' },
  title: { margin: 0, fontSize: 'clamp(2rem, 6vw, 4rem)' },
  copy: { maxWidth: '30rem', margin: 0, color: '#d8cec2', lineHeight: 1.6 },
  actions: { display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem' },
  primary: { border: 0, padding: '0.8rem 1.1rem', background: '#d58c3d', color: '#100c0a', cursor: 'pointer', fontWeight: 700 },
  secondary: { border: '1px solid #f5f0e8', padding: '0.8rem 1.1rem', color: '#f5f0e8', textDecoration: 'none', fontWeight: 700 },
};
