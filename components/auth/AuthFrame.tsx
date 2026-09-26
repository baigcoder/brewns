import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/app/console.css';

/** The two-panel frame for every sign-in page: the brand on one side, the form on the other. */
export function AuthFrame({ title, lede, points, children }: { title: ReactNode; lede: string; points?: string[]; children: ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-art">
        <span aria-hidden="true" className="auth-swirl swirl-mask mask" />
        <Link href="/" aria-label="brewns, back to the site" className="wordmark mask" />
        <div style={{ display: 'grid', gap: 18, position: 'relative' }}>
          <h1>{title}</h1>
          <p>{lede}</p>
        </div>
        {points ? (
          <ul>
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <span />
        )}
      </section>
      <main className="auth-panel">{children}</main>
    </div>
  );
}
