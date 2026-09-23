'use client';

import React from 'react';

export function SiteFooter() {
  return (
    <footer
      id="ftr"
      aria-label="Footer and Directory"
      className="site-footer"
    >
      <div className="container-max">
        {/* Large Typographic Statement */}
        <div style={{ marginBottom: '4rem', borderBottom: '1px solid var(--border-dark)', paddingBottom: '3rem' }}>
          <p style={{ fontFamily: 'var(--font-geist)', fontWeight: 700, fontSize: 'clamp(2rem, 4.5vw, 3.75rem)', letterSpacing: 'var(--tracking-tight)', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 'var(--leading-headline)' }}>
            COFFEE FOR RIGHT NOW. MADE FOR YOUR DAY.
          </p>
        </div>

        {/* Directory Grid */}
        <div className="footer-directory-grid">
          {/* Col 1: Brand Wordmark & Info */}
          <div>
            <p style={{ fontFamily: 'var(--font-geist)', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.02em', textTransform: 'lowercase', marginBottom: '0.75rem' }}>
              brewns
            </p>
            <p style={{ color: 'var(--fg-muted-light)', lineHeight: 1.6, fontSize: '0.75rem' }}>
              Specialty Coffee House &amp; Roastery. Sourced directly from high-altitude smallholders. Roasted weekly in San Francisco.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', marginBottom: '1rem', fontWeight: 700 }}>
              <span style={{ letterSpacing: '-0.23em' }}>//</span> Directory
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', color: 'var(--fg-muted-light)' }}>
              <li><a href="#shop" style={{ transition: 'color 200ms' }}>Shop</a></li>
              <li><a href="#menu" style={{ transition: 'color 200ms' }}>Menu</a></li>
              <li><a href="#story" style={{ transition: 'color 200ms' }}>Our Story</a></li>
              <li><a href="#locations" style={{ transition: 'color 200ms' }}>Locations</a></li>
              <li><a href="#order" style={{ transition: 'color 200ms' }}>Order Ahead</a></li>
            </ul>
          </div>

          {/* Col 3: Counters */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', marginBottom: '1rem', fontWeight: 700 }}>
              <span style={{ letterSpacing: '-0.23em' }}>//</span> Locations
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--fg-muted-light)', fontSize: '0.75rem' }}>
              <div>
                <p style={{ color: '#fff', fontWeight: 700 }}>139 COFFEE STREET</p>
                <p>Mission District · Open 07:00–21:00</p>
              </div>
              <div>
                <p style={{ color: '#fff', fontWeight: 700 }}>310 VALENCIA STREET</p>
                <p>Valencia Corridor · Open 07:00–21:00</p>
              </div>
              <div>
                <p style={{ color: '#fff', fontWeight: 700 }}>56 COLUMBUS AVENUE</p>
                <p>Jackson Square · Open 07:00–20:00</p>
              </div>
            </div>
          </div>

          {/* Col 4: Contact & Social */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)', marginBottom: '1rem', fontWeight: 700 }}>
              <span style={{ letterSpacing: '-0.23em' }}>//</span> Contact
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', color: 'var(--fg-muted-light)', fontSize: '0.75rem' }}>
              <li>
                <a href="mailto:hello@brewns.coffee" style={{ transition: 'color 200ms' }}>
                  hello@brewns.coffee
                </a>
              </li>
              <li>
                <a href="tel:+14155298812" style={{ transition: 'color 200ms' }}>
                  (415) 529-8812
                </a>
              </li>
              <li style={{ paddingTop: '0.5rem', display: 'flex', gap: '0.75rem', opacity: 0.7 }}>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
                <span>/</span>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Bottom Bar */}
        <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--fg-muted-light)' }}>
          <p>© 2026 BREWNS COFFEE HOUSE. ALL RIGHTS RESERVED.</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a href="#privacy">PRIVACY POLICY</a>
            <span>/</span>
            <a href="#terms">TERMS OF SERVICE</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
