import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';

/** The frame for the policy pages: the site's header and footer, a title, the text, on the menu's paper colour. */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader theme="light" />
      <div className="legal">
        <main className="legal-main">
          <p className="legal-eyebrow">
            <span>{'//'}</span> {eyebrow}
          </p>
          <h1 className="legal-h1">{title}</h1>
          <p className="legal-updated">LAST UPDATED {updated}</p>
          <div className="legal-body">{children}</div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
