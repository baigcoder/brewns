import Link from 'next/link';
import type { ReactNode } from 'react';

/** The frame for /privacy and /terms: the wordmark back home, a title, the text, a short footer. */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link href="/" aria-label="brewns, back to the home page" className="legal-mark wordmark mask" />
        <nav aria-label="Legal" className="legal-nav">
          <Link href="/privacy">PRIVACY</Link>
          <Link href="/terms">TERMS</Link>
          <Link href="/">← BACK TO BREWNS</Link>
        </nav>
      </header>
      <main className="legal-main">
        <p className="legal-eyebrow">
          <span>{'//'}</span> {eyebrow}
        </p>
        <h1 className="legal-h1">{title}</h1>
        <p className="legal-updated">LAST UPDATED {updated}</p>
        <div className="legal-body">{children}</div>
      </main>
      <footer className="legal-foot">
        <p>© {new Date().getFullYear()} BREWNS COFFEE HOUSE · LAHORE</p>
        <p>
          QUESTIONS? <a href="mailto:hello@brewns.coffee">HELLO@BREWNS.COFFEE</a>
        </p>
      </footer>
    </div>
  );
}
