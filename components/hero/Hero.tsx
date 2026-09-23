'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { OpalesceShader } from './OpalesceShader';
import { HeroCard } from './HeroCard';

// Dynamically import R3F scene to optimize initial page load performance
const CoffeeStudioScene = dynamic(
  () => import('@/components/three/CoffeeStudioScene').then((mod) => mod.CoffeeStudioScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '1.5rem', background: 'rgba(14,13,12,0.8)', backdropFilter: 'blur(8px)', maxWidth: '20rem', width: '100%', textAlign: 'center' }}>
          <p className="t-eyebrow" style={{ color: '#D58C3D', marginBottom: '0.5rem' }}>// COFFEE STUDIO</p>
          <p className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>SLOW ROAST NO. 4</p>
          <div style={{ width: '3rem', height: '3rem', margin: '1rem auto', borderWidth: '2px', borderStyle: 'solid', borderColor: '#D58C3D transparent rgba(255,255,255,0.2) rgba(255,255,255,0.2)', borderRadius: '9999px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>Loading tactile studio...</p>
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
      aria-label="Specialty Coffee House"
      className="hero-section"
    >
      {/* 1. Custom WebGL2 Opalesce Noise Background */}
      <OpalesceShader />

      {/* 2. Main Hero Composition */}
      <div className="hero-inner">
        {/* Left Column: Editorial Headline & Copy */}
        <div className="hero-copy">
          <div className="hero-head" style={{ display: 'grid', justifyItems: 'start' }}>
            <div style={{ gridColumnStart: 1, gridRowStart: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', textTransform: 'uppercase' }}>
              <p className="t-eyebrow">
                <span style={{ letterSpacing: '-0.23em' }}>//</span>
                <span style={{ letterSpacing: '-0.115em' }}> </span>
                Specialty Coffee House
              </p>
              <h1 className="hero-h1">
                COFFEE FOR YOUR
              </h1>
            </div>
            <span
              className="hero-script-overlap"
              style={{ gridColumnStart: 1, gridRowStart: 1, marginLeft: '9.75rem' }}
            >
              moment
            </span>
          </div>

          <div className="hero-lede">
            <p className="t-lede">
              Carefully sourced high-altitude microlots, thoughtfully roasted in San Francisco to bring out the vibrant sweetness in every pour.
            </p>

            <div className="hero-cta-row">
              <a href="#order" className="btn-primary">
                <span>ORDER AHEAD</span>
                <span>→</span>
              </a>
              <a href="#menu" className="btn-secondary">
                EXPLORE MENU
              </a>
            </div>
          </div>
        </div>

        {/* Right: 3D Interactive Coffee Studio */}
        <div className="hero-media-mount">
          <HeroCard hoveredObject={hoveredObject} />
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <CoffeeStudioScene onHoverObject={setHoveredObject} />
          </div>
        </div>
      </div>

      {/* 3. Hero Bottom Info Bar */}
      <aside
        aria-label="Hours and Location Information"
        className="hero-bar"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', width: 'max-content' }}>
          <span className="status-dot" />
          <span>OPEN DAILY 07:00 – 21:00</span>
        </div>
        <span className="hero-rule" />
        <address style={{ width: 'max-content' }}>
          139 COFFEE STREET, MISSION DISTRICT, SF
        </address>
        <span className="hero-rule hero-rule-b" />
        <div className="hero-rule-b" style={{ display: 'flex', flexDirection: 'column', width: 'max-content' }}>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">INSTAGRAM</a>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">TIKTOK</a>
        </div>
      </aside>
    </section>
  );
}
