'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { STORY_DATA } from '@/data/story';

const BeanFieldScene = dynamic(
  () => import('@/components/three/BeanFieldScene').then((mod) => mod.BeanFieldScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-t-[#D58C3D] border-white/20 rounded-full animate-spin" />
      </div>
    ),
  }
);

export function PhilosophySection() {
  return (
    <section
      id="story"
      aria-label="Our Philosophy & Sourcing"
      className="phil-section"
    >
      <div className="container-max" style={{ position: 'relative', zIndex: 10 }}>
        {/* Eyebrow & Large Display Statement */}
        <div style={{ maxWidth: '48rem', marginBottom: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>//</span>
            <p className="t-eyebrow">OUR PHILOSOPHY</p>
          </div>
          <h2 className="t-display" style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)', color: '#fff', marginBottom: '1.5rem' }}>
            {STORY_DATA.headline}
          </h2>
          <p className="t-lede" style={{ maxWidth: '42rem' }}>
            {STORY_DATA.lede}
          </p>
        </div>

        {/* 3D Drifting Bean Field Scene Container */}
        <div style={{ position: 'relative', width: '100%', height: '500px', marginBottom: '4rem', border: '1px solid var(--border-dark)', backgroundColor: '#090807', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', borderRadius: '2px' }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <BeanFieldScene />
          </div>

          {/* Top Editorial Overlay Tag */}
          <div style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
            <span className="status-dot" style={{ width: '0.35rem', height: '0.35rem' }} />
            <span>ATMOSPHERE 01 // HIGH-ALTITUDE MICROLOTS</span>
          </div>

          {/* Bottom Left Narrative Caption */}
          <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.5rem', zIndex: 10, maxWidth: '24rem', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Whole washed Arabica beans floating in kinetic drift around our hand-cast ceramic cup.
          </div>

          {/* Bottom Right Tactile Interaction Prompt */}
          <div style={{ position: 'absolute', bottom: '1.25rem', right: '1.5rem', zIndex: 10, fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.12em', color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
            TOUCH / DRAG FOR TACTILE PARALLAX →
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="phil-pillars-grid">
          {STORY_DATA.pillars.map((pillar, i) => (
            <article
              key={pillar.title}
              style={{
                border: '1px solid var(--border-dark)',
                backgroundColor: 'var(--bg-card-dark)',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div>
                <p className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', marginBottom: '1rem' }}>0{i + 1} / PILLAR</p>
                <h3 className="font-mono" style={{ fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: '#fff' }}>
                  {pillar.title}
                </h3>
                <p style={{ color: 'var(--fg-muted-light)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                  {pillar.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Brand Quotes Statement Row */}
        <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--fg-muted-light)' }}>
          {STORY_DATA.quotes.map((quote, idx) => (
            <div key={quote} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="status-dot" />
              <span style={{ color: '#fff', fontWeight: 700 }}>{quote}</span>
              {idx < STORY_DATA.quotes.length - 1 && (
                <span style={{ color: 'rgba(255, 255, 255, 0.2)', marginLeft: '1.5rem' }}>/</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
