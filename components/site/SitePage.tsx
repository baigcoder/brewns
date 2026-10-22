import type { ReactNode } from 'react';
import '@/app/console.css';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './site-page.css';

/**
 * The frame for the site's own pages (about, locations, the tools): the same
 * header and footer as every other page, and the page in a centred column.
 * `current` is kept for the callers; the header works out the current page itself.
 */
export function SitePage({ width = 880, children }: { current?: string; width?: number; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="sp">
        <main className="sp-main" style={{ maxWidth: width }}>
          {children}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
