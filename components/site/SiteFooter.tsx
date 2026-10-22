import Link from 'next/link';
import { CAFES, mapsUrl } from '@/lib/locations';
import { FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/siteNav';
import './chrome.css';

/** The footer on every page except home: where to go, where we are, and the small print. */
export function SiteFooter() {
  return (
    <footer className="gf">
      <div className="gf-top">
        <div className="gf-brand">
          <Link href="/" aria-label="brewns home" className="gf-mark">
            <span className="wordmark mask" aria-hidden="true" />
          </Link>
          <p className="gf-line">Specialty coffee, made with care and handed over fast. Three counters across Lahore, open every day 07:00–21:00.</p>
          <div className="gf-actions">
            <Link href="/#order" className="gf-btn">
              Order online →
            </Link>
            <Link href="/reserve" className="gf-btn ghost">
              Book a table
            </Link>
          </div>
        </div>
        <nav className="gf-cols" aria-label="Footer">
          {FOOTER_COLUMNS.map(([heading, links]) => (
            <div key={heading}>
              <p>{heading}</p>
              <ul>
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <ul className="gf-cafes" aria-label="Our counters">
        {CAFES.map((c) => (
          <li key={c.id}>
            <b>{c.name}</b>
            <span>{c.area}</span>
            <a href={mapsUrl(c)} target="_blank" rel="noopener noreferrer">
              Directions ↗
            </a>
          </li>
        ))}
      </ul>
      <div className="gf-bottom">
        <p>© {new Date().getFullYear()} brewns coffee house · Lahore</p>
        <p className="gf-contact">
          <a href="mailto:hello@brewns.coffee">hello@brewns.coffee</a>
          <a href="tel:+924212345678">+92 42 1234 5678</a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">TikTok</a>
        </p>
        <nav aria-label="Legal" className="gf-legal">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <span className="gf-giant wordmark mask" aria-hidden="true" />
    </footer>
  );
}
