'use client';

import React, { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LOCATIONS } from '@/data/locations';

const CoffeeClockScene = dynamic(
  () => import('@/components/three/CoffeeClockScene').then((mod) => mod.CoffeeClockScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-t-[#D58C3D] border-black/20 rounded-full animate-spin" />
      </div>
    ),
  }
);

interface TimeBand {
  time: string;
  phase: string;
  copy: string;
}

const TIME_BANDS: TimeBand[] = [
  {
    time: '07:00',
    phase: 'FIRST LIGHT',
    copy: 'Dialing in the Mazzer grinders. First pour of washed single-origin drip & warm cardamom knots fresh from the morning oven.',
  },
  {
    time: '11:00',
    phase: 'MIDDAY BREW',
    copy: 'Silky 60°C flat whites and draft cold brew poured over artisan ice. Peak counter energy across all three locations.',
  },
  {
    time: '15:00',
    phase: 'AFTERNOON FOCUS',
    copy: 'Uji ceremonial iced matcha whisked to order. Slow batch pour-overs and chocolate-dipped viennoiserie.',
  },
  {
    time: '19:00',
    phase: 'GOLDEN HOUR',
    copy: 'Natural process decaf flights and quiet counter conversations. Relaxed evening rhythm until close at 21:00.',
  },
];

export function LocationsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeBandIdx, setActiveBandIdx] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate progress from when section enters viewport to when it leaves
      const totalDistance = rect.height + windowHeight;
      const currentPos = windowHeight - rect.top;
      const progress = Math.max(0, Math.min(1, currentPos / totalDistance));

      setScrollProgress(progress);

      // Determine active time band (4 phases)
      const bandIndex = Math.min(
        TIME_BANDS.length - 1,
        Math.floor(progress * TIME_BANDS.length)
      );
      setActiveBandIdx(bandIndex);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentBand = TIME_BANDS[activeBandIdx];
  const clockAngle = scrollProgress * 360;

  return (
    <section
      ref={sectionRef}
      id="locations"
      aria-label="Our Locations and Coffee Clock"
      className="locations-section"
    >
      <div className="container-max">
        <div className="locs-grid">
          {/* Left Column: Locations & Time-Band Narratives */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>//</span>
                <p className="t-eyebrow-dark">LOCATIONS & TIME</p>
              </div>
              <h2 className="t-headline">CALIBRATED TO YOUR DAY.</h2>
            </div>

            {/* Dynamic Time Band Panel */}
            <div style={{ border: '1px solid var(--border-light)', backgroundColor: '#fff', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="status-dot" />
                  <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700 }}>{currentBand.time}</span>
                </div>
                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {currentBand.phase}
                </span>
              </div>
              <p style={{ color: 'rgba(7, 7, 7, 0.8)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                {currentBand.copy}
              </p>
            </div>

            {/* Location Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {LOCATIONS.map((loc) => (
                <div
                  key={loc.id}
                  style={{
                    border: '1px solid var(--border-light)',
                    padding: '1.25rem',
                    backgroundColor: '#fff',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(7, 7, 7, 0.5)', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700 }}>{loc.code}</span>
                    <span>{loc.district}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div>
                      <p className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {loc.name}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(7, 7, 7, 0.7)', fontFamily: 'var(--font-mono)', marginTop: '0.125rem' }}>{loc.address}</p>
                    </div>
                    <a
                      href={loc.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: '#070707',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      MAP & DIRECTIONS →
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'rgba(7, 7, 7, 0.6)' }}>
                    <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{loc.hours}</span>
                    <span>{loc.seating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Architectural Clock Face + Centered 3D Iced Latte */}
          <div style={{ position: 'relative', height: '540px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Architectural Clock Ring */}
            <div style={{ position: 'relative', width: '420px', height: '420px', maxWidth: '100%', maxHeight: '100%', borderRadius: '9999px', border: '1px solid var(--border-light)', backgroundColor: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Hour Numbers 1 to 12 along the circumference */}
              {Array.from({ length: 12 }).map((_, i) => {
                const hour = i + 1;
                const angleRad = ((hour * 30 - 90) * Math.PI) / 180;
                const radiusPercent = 42; // percentage from center
                const x = (50 + radiusPercent * Math.cos(angleRad)).toFixed(2);
                const y = (50 + radiusPercent * Math.sin(angleRad)).toFixed(2);

                return (
                  <span
                    key={hour}
                    className="font-mono"
                    style={{
                      position: 'absolute',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'rgba(7, 7, 7, 0.6)',
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {String(hour).padStart(2, '0')}
                  </span>
                );
              })}

              {/* Tick Marks */}
              {Array.from({ length: 60 }).map((_, i) => {
                const angle = i * 6;
                const isHour = i % 5 === 0;
                return (
                  <div
                    key={i}
                    className="absolute inset-0 flex justify-center pointer-events-none"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <div
                      className={`bg-black/40 ${isHour ? 'w-0.5 h-3 bg-black' : 'w-[1px] h-1.5'}`}
                    />
                  </div>
                );
              })}

              {/* Rotating Clock Hand Indicator */}
              <div
                className="absolute w-full h-full pointer-events-none transition-transform duration-75 ease-out"
                style={{ transform: `rotate(${clockAngle}deg)` }}
              >
                <div className="w-0.5 h-1/3 bg-[#D58C3D] mx-auto origin-bottom shadow-sm" />
              </div>

              {/* Centered 3D Canvas Mount Point */}
              <div className="w-56 h-72 md:w-72 md:h-88 relative z-10">
                <CoffeeClockScene scrollProgress={scrollProgress} />
              </div>

              {/* Ambient Circular Glow */}
              <div className="absolute inset-0 rounded-full border border-black/5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
