'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { OpalesceShader } from './OpalesceShader';
import { HeroCard } from './HeroCard';

// Dynamically import R3F scene to optimize initial page load performance (FR-08)
const CoffeeStudioScene = dynamic(
  () => import('@/components/three/CoffeeStudioScene').then((mod) => mod.CoffeeStudioScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="border border-white/15 p-6 rounded-sm bg-[#0E0D0C]/80 backdrop-blur-sm max-w-sm w-full text-center">
          <p className="t-eyebrow text-[#D58C3D] mb-2">// 3D COFFEE STUDIO</p>
          <p className="font-mono text-xl font-bold uppercase mb-1">SLOW ROAST NO. 4</p>
          <div className="w-16 h-16 mx-auto my-4 border-2 border-t-[#D58C3D] border-white/20 rounded-full animate-spin" />
          <p className="text-xs text-white/50 font-mono">Loading tactile studio...</p>
        </div>
      </div>
    ),
  }
);

export function Hero() {
  const [hoveredObject, setHoveredObject] = useState<'bag' | 'cup' | null>(null);

  return (
    <section
      id="hero"
      aria-label="Specialty Coffee Roastery"
      className="hero-section"
    >
      {/* 1. Custom WebGL2 Opalesce Noise Background */}
      <OpalesceShader />

      {/* 2. Main Hero Composition */}
      <div className="hero-grid">
        {/* Left Column: Editorial Headline & Copy */}
        <div className="hero-copy">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>//</span>
            <p className="t-eyebrow">
              SPECIALTY COFFEE HOUSE & ROASTERY
            </p>
          </div>

          <div className="hero-h1-group">
            <h1 className="t-display text-white">
              COFFEE FOR YOUR
              <span className="hero-script-overlap">
                moment
              </span>
            </h1>
          </div>

          <p className="t-lede" style={{ maxWidth: '36rem' }}>
            CAREFULLY SOURCED HIGH-ALTITUDE MICROLOTS, THOUGHTFULLY ROASTED IN SAN FRANCISCO TO BRING OUT THE VIBRANT SWEETNESS IN EVERY POUR.
          </p>

          <div className="hero-cta-row">
            <a
              href="#order"
              className="btn-primary"
            >
              <span>ORDER AHEAD</span>
              <span>→</span>
            </a>
            <a
              href="#menu"
              className="btn-secondary"
            >
              EXPLORE MENU
            </a>
          </div>
        </div>

        {/* Right Column: 3D Interactive Coffee Studio */}
        <div className="hero-media-mount">
          <HeroCard hoveredObject={hoveredObject} />
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <CoffeeStudioScene onHoverObject={setHoveredObject} />
          </div>
        </div>
      </div>

      {/* 3. Hero Bottom Metadata Bar */}
      <aside
        aria-label="Hours and Location Information"
        className="hero-bar"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="status-dot" />
          <span>OPEN DAILY 07:00 – 21:00</span>
        </div>
        <address style={{ fontStyle: 'normal' }}>
          139 COFFEE STREET, MISSION DISTRICT, SF
        </address>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.7 }}>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
            INSTAGRAM
          </a>
          <span>/</span>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">
            TIKTOK
          </a>
        </div>
      </aside>
    </section>
  );
}
