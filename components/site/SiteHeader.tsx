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
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-10 md:py-6 transition-colors duration-300 ${
          isLight
            ? 'bg-[#F1F1EF]/85 text-[#070707] border-b border-black/10'
            : 'bg-[#070707]/85 text-white border-b border-white/10'
        } backdrop-blur-md`}
      >
        {/* Brand Wordmark */}
        <div className="flex items-center gap-6">
          <a
            href="#hero"
            className="font-mono font-bold tracking-widest text-lg uppercase transition-opacity hover:opacity-70"
            aria-label="Veldt Coffee House Home"
          >
            VELDT<span className="text-[#D58C3D]">.</span>
          </a>
        </div>

        {/* Desktop Nav */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest"
        >
          <a
            href="#shop"
            className={`transition-colors ${isLight ? 'text-black/70 hover:text-black' : 'text-white/70 hover:text-white'}`}
          >
            01 / Shop
          </a>
          <a
            href="#menu"
            className={`transition-colors ${isLight ? 'text-black/70 hover:text-black' : 'text-white/70 hover:text-white'}`}
          >
            02 / Menu
          </a>
          <a
            href="#locations"
            className={`transition-colors ${isLight ? 'text-black/70 hover:text-black' : 'text-white/70 hover:text-white'}`}
          >
            03 / Locations
          </a>
          <a
            href="#story"
            className={`transition-colors ${isLight ? 'text-black/70 hover:text-black' : 'text-white/70 hover:text-white'}`}
          >
            04 / Story
          </a>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4 md:gap-6">
          <a
            href="#order"
            className={`hidden sm:flex items-center gap-2 font-mono text-xs uppercase tracking-wider transition-colors hover:text-[#D58C3D] ${
              isLight ? 'text-black' : 'text-white'
            }`}
          >
            <span className="status-dot" />
            <span>ORDER ONLINE</span>
          </a>

          <button
            id="bag-open-btn"
            onClick={onOpenBag}
            className={`font-mono text-xs uppercase tracking-wider px-3.5 py-1.5 border transition-all duration-200 ${
              isLight
                ? 'border-black/25 text-black hover:border-black'
                : 'border-white/25 text-white hover:border-white'
            }`}
            aria-label={`Open shopping bag with ${bagCount} items`}
          >
            <span>BAG</span> <span className="font-bold ml-1">({bagCount})</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden relative w-9 h-9 flex flex-col items-center justify-center gap-1.5 focus:outline-none"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span
              className={`w-5 h-0.5 transition-all duration-200 ${
                isLight ? 'bg-black' : 'bg-white'
              } ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}
            />
            <span
              className={`w-3.5 h-0.5 ml-auto transition-all duration-200 ${
                isLight ? 'bg-black' : 'bg-white'
              } ${mobileMenuOpen ? '-rotate-45 -translate-y-0.5 w-5' : ''}`}
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
