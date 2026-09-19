'use client';

import React from 'react';

export function SiteFooter() {
  return (
    <footer
      id="ftr"
      aria-label="Footer and Directory"
      className="relative py-20 px-6 md:px-12 bg-[#070707] text-white border-t border-white/15 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* Large Typographic Statement */}
        <div className="mb-16 border-b border-white/10 pb-12">
          <p className="font-mono text-xs tracking-widest text-[#D58C3D] uppercase mb-4">
            // VELDT COFFEE HOUSE · SAN FRANCISCO
          </p>
          <p className="t-headline text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white/90">
            COFFEE FOR RIGHT NOW. MADE FOR YOUR DAY.
          </p>
        </div>

        {/* Directory Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 font-mono text-xs mb-16">
          {/* Col 1: Brand Wordmark & Info */}
          <div>
            <p className="font-bold text-lg tracking-widest uppercase mb-3">
              VELDT<span className="text-[#D58C3D]">.</span>
            </p>
            <p className="text-white/60 leading-relaxed text-[11px]">
              Specialty Coffee Roastery & House. Sourced directly from high-altitude smallholders. Roasted weekly in San Francisco.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <p className="text-[#D58C3D] uppercase tracking-wider mb-4 font-bold">// DIRECTORY</p>
            <ul className="space-y-2.5 text-white/70">
              <li><a href="#shop" className="hover:text-white transition-colors">01 / The Shop</a></li>
              <li><a href="#menu" className="hover:text-white transition-colors">02 / Favorites Menu</a></li>
              <li><a href="#locations" className="hover:text-white transition-colors">03 / Café Locations</a></li>
              <li><a href="#story" className="hover:text-white transition-colors">04 / Our Philosophy</a></li>
              <li><a href="#order" className="hover:text-white transition-colors">05 / Order Ahead</a></li>
            </ul>
          </div>

          {/* Col 3: Counters */}
          <div>
            <p className="text-[#D58C3D] uppercase tracking-wider mb-4 font-bold">// ATELIERS</p>
            <div className="space-y-3 text-white/70 text-[11px]">
              <div>
                <p className="text-white font-bold">139 COFFEE STREET</p>
                <p>Mission District · Open 07:00–21:00</p>
              </div>
              <div>
                <p className="text-white font-bold">310 VALENCIA STREET</p>
                <p>Valencia Corridor · Open 07:00–21:00</p>
              </div>
              <div>
                <p className="text-white font-bold">56 COLUMBUS AVENUE</p>
                <p>Jackson Square · Open 07:00–20:00</p>
              </div>
            </div>
          </div>

          {/* Col 4: Contact & Social */}
          <div>
            <p className="text-[#D58C3D] uppercase tracking-wider mb-4 font-bold">// CONTACT</p>
            <ul className="space-y-2.5 text-white/70 text-[11px]">
              <li>
                <a href="mailto:hello@veldt.coffee" className="hover:text-white transition-colors">
                  hello@veldt.coffee
                </a>
              </li>
              <li>
                <a href="tel:+14155298812" className="hover:text-white transition-colors">
                  (415) 529-8812
                </a>
              </li>
              <li className="pt-2 flex gap-3 text-white/50">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  INSTAGRAM
                </a>
                <span>/</span>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  TIKTOK
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-white/50">
          <p>© 2026 VELDT COFFEE HOUSE. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-4">
            <a href="#privacy" className="hover:text-white">PRIVACY POLICY</a>
            <span>/</span>
            <a href="#terms" className="hover:text-white">TERMS OF SERVICE</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
