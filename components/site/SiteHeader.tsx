'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ANNOUNCEMENT, HEADER_LINKS } from '@/lib/siteNav';
import './chrome.css';

/** How many things are in the bag, from the same storage the home page's bag uses. */
function bagCount() {
  try {
    const items = JSON.parse(localStorage.getItem('brewns-bag') || '[]') as { qty?: number }[];
    return items.reduce((n, i) => n + (Number(i?.qty) > 0 ? Number(i.qty) : 0), 0);
  } catch {
    return 0;
  }
}

/**
 * The header on every page except home (which animates its own): the
 * announcement line, the links, the brewns wordmark in the middle, and order
 * and bag on the right. On a phone the links fold into a full-screen menu.
 */
export function SiteHeader({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [bag, setBag] = useState(0);

  useEffect(() => {
    const read = () => setBag(bagCount());
    read();
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('focus', read);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = (href: string) => (href.startsWith('/#') ? false : path === href || path.startsWith(`${href}/`));

  return (
    <>
      <p className="gh-note">
        <span>{ANNOUNCEMENT.text}</span>
        <span className="gh-note-more">{ANNOUNCEMENT.more}</span>
        <Link href={ANNOUNCEMENT.href}>{ANNOUNCEMENT.cta} →</Link>
      </p>
      <header className={`gh${open ? ' open' : ''}`} data-theme={open ? 'dark' : theme}>
        <button type="button" className="gh-toggle" aria-expanded={open} aria-controls="gh-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          <span />
          <span />
        </button>
        <nav aria-label="Primary" className="gh-nav">
          {HEADER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="gh-mark" aria-label="brewns home">
          <span className="wordmark mask" aria-hidden="true" />
        </Link>
        <div className="gh-right">
          <Link href="/reserve" className="gh-link gh-hide-sm" aria-current={current('/reserve') ? 'page' : undefined}>
            Reserve
          </Link>
          <Link href="/#order" className="gh-order">
            <i aria-hidden="true" />
            Order online
          </Link>
          <Link href="/?bag=open" className="gh-bag" aria-label={`Bag, ${bag} item${bag === 1 ? '' : 's'}`}>
            Bag <span className={bag ? 'has' : undefined}>{bag}</span>
          </Link>
        </div>
      </header>
      <div className="gh-menu" id="gh-menu" hidden={!open}>
        <nav aria-label="Menu">
          {HEADER_LINKS.map((l, i) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ animationDelay: `${60 + i * 50}ms` }}>
              {l.label}
            </Link>
          ))}
          <Link href="/reserve" onClick={() => setOpen(false)} style={{ animationDelay: `${60 + HEADER_LINKS.length * 50}ms` }}>
            Book a table
          </Link>
        </nav>
        <p className="gh-menu-foot">
          Open daily 07:00–21:00 · <a href="tel:+924212345678">+92 42 1234 5678</a>
        </p>
      </div>
    </>
  );
}
