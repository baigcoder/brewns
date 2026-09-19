'use client';

import React, { useState, useEffect } from 'react';
import { MobileMenu } from './MobileMenu';

interface SiteHeaderProps {
  bagCount: number;
  onOpenBag: () => void;
}

export function SiteHeader({ bagCount, onOpenBag }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const handleScroll = () => {
      // Check sections with light theme attribute or light background
      const probeOffset = 60;
      const menuSection = document.getElementById('menu');
      const locsSection = document.getElementById('locations');

      let currentTheme: 'dark' | 'light' = 'dark';

      if (menuSection) {
        const rect = menuSection.getBoundingClientRect();
        if (rect.top <= probeOffset && rect.bottom > probeOffset) {
          currentTheme = 'light';
        }
      }

      if (locsSection) {
        const rect = locsSection.getBoundingClientRect();
        if (rect.top <= probeOffset && rect.bottom > probeOffset) {
          currentTheme = 'light';
        }
      }

      setTheme(currentTheme);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLight = theme === 'light' && !mobileMenuOpen;

  return (
    <>
      <header
        id="hdr"
        className={`site-hdr ${isLight ? 'theme-light' : 'theme-dark'}`}
      >
        {/* Brand Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a
            href="#hero"
            className="font-mono"
            style={{ fontWeight: 700, letterSpacing: '0.12em', fontSize: '1.125rem', textTransform: 'uppercase' }}
            aria-label="Veldt Coffee House Home"
          >
            VELDT<span style={{ color: 'var(--accent-amber)' }}>.</span>
          </a>
        </div>

        {/* Desktop Nav */}
        <nav
          aria-label="Primary"
          className="hdr-nav-list"
        >
          <a href="#shop">01 / Shop</a>
          <a href="#menu">02 / Menu</a>
          <a href="#locations">03 / Locations</a>
          <a href="#story">04 / Story</a>
        </nav>

        {/* Right Actions */}
        <div className="hdr-right-actions">
          <a
            href="#order"
            className="hdr-order-link"
          >
            <span className="status-dot" />
            <span>ORDER ONLINE</span>
          </a>

          <button
            id="bag-open-btn"
            onClick={onOpenBag}
            className="hdr-bag-btn"
            aria-label={`Open shopping bag with ${bagCount} items`}
          >
            <span>BAG</span> <strong style={{ marginLeft: '0.25rem' }}>({bagCount})</strong>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-toggle-btn"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span
              style={{
                width: '1.25rem',
                height: '2px',
                backgroundColor: isLight ? '#070707' : '#ffffff',
                transition: 'all 0.2s',
                transform: mobileMenuOpen ? 'rotate(45deg) translateY(6px)' : 'none',
              }}
            />
            <span
              style={{
                width: '1.25rem',
                height: '2px',
                backgroundColor: isLight ? '#070707' : '#ffffff',
                transition: 'all 0.2s',
                transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
              }}
            />
          </button>
        </div>
      </header>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenBag={onOpenBag}
        bagCount={bagCount}
      />
    </>
  );
}
