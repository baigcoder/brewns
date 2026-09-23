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
        {/* Left: ORDER ONLINE on desktop / wordmark on mobile */}
        <a
          href="#order"
          className="hdr-order-link"
          style={{ textTransform: 'uppercase' }}
        >
          <span className="status-dot" />
          <span>ORDER ONLINE</span>
        </a>

        {/* Center: Brand Wordmark */}
        <a
          href="#hero"
          className="hdr-wordmark"
          aria-label="brewns coffee house — home"
        >
          brewns
        </a>

        {/* Desktop Nav */}
        <nav aria-label="Primary" className="hdr-nav-list">
          <a href="#shop">Shop</a>
          <a href="#menu">Menu</a>
          <a href="#story">Our Story</a>
          <a href="#locations">Locations</a>
        </nav>

        {/* Right Actions */}
        <div className="hdr-right-actions">
          <button
            id="bag-open-btn"
            onClick={onOpenBag}
            className="hdr-bag-btn"
            aria-label={`Open shopping bag with ${bagCount} items`}
          >
            <span>Bag</span> <strong style={{ marginLeft: '0.25rem' }}>{bagCount}</strong>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-toggle-btn"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span
              style={{
                position: 'absolute',
                right: '0.5rem',
                height: '1px',
                width: '1.5rem',
                backgroundColor: 'currentColor',
                transition: 'all 250ms var(--ease-entrance)',
                transform: mobileMenuOpen ? 'rotate(45deg)' : 'translateY(-0.25rem)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: '0.5rem',
                height: '1px',
                width: mobileMenuOpen ? '1.5rem' : '1rem',
                backgroundColor: 'currentColor',
                transition: 'all 250ms var(--ease-entrance)',
                transform: mobileMenuOpen ? 'rotate(-45deg)' : 'translateY(0.25rem)',
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
