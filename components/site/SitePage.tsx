import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/app/console.css';
import './site-page.css';

const LINKS = [
  { href: '/#menu', label: 'Menu', key: 'menu' },
  { href: '/reserve', label: 'Reserve', key: 'reserve' },
  { href: '/brew-timer', label: 'Brew Timer', key: 'brew-timer' },
  { href: '/flavor-wheel', label: 'Flavors', key: 'flavor-wheel' },
] as const;

/**
 * The frame for the site's own tool pages (reserve, brew timer, flavor
 * matcher): the real brewns wordmark, the same links on every page with the
 * current one marked, and a way back to the bag.
 */
export function SitePage({ current, width = 880, children }: { current: (typeof LINKS)[number]['key']; width?: number; children: ReactNode }) {
  return (
    <div className="sp">
      <header className="sp-hdr" style={{ maxWidth: width }}>
        <Link href="/" className="sp-mark" aria-label="brewns home">
          <span className="wordmark mask" aria-hidden="true" />
        </Link>
        <nav aria-label="Site" className="sp-nav">
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} className={l.key === current ? 'on' : undefined} aria-current={l.key === current ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/?bag=open" className="sp-bag">
          Bag
        </Link>
      </header>
      <main className="sp-main" style={{ maxWidth: width }}>
        {children}
      </main>
      <footer className="sp-foot" style={{ maxWidth: width }}>
        <span>brewns coffee house · Lahore</span>
        <span>Open daily 07:00–21:00</span>
      </footer>
    </div>
  );
}
