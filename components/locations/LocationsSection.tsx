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
      className="relative py-28 px-6 md:px-12 bg-[#F1F1EF] text-[#070707] overflow-hidden border-t border-black/10"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Locations & Time-Band Narratives */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#D58C3D] font-mono text-sm font-bold">//</span>
                <p className="t-eyebrow-dark">LOCATIONS & TIME</p>
              </div>
              <h2 className="t-headline">CALIBRATED TO YOUR DAY.</h2>
            </div>

            {/* Dynamic Time Band Panel */}
            <div className="border border-black/15 bg-white p-6 transition-all duration-300 shadow-sm">
              <div className="flex items-baseline justify-between border-b border-black/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="status-dot" />
                  <span className="font-mono text-xl font-bold">{currentBand.time}</span>
                </div>
                <span className="font-mono text-xs font-bold text-[#D58C3D] uppercase tracking-widest">
                  {currentBand.phase}
                </span>
              </div>
              <p className="text-black/80 text-xs font-mono leading-relaxed">
                {currentBand.copy}
              </p>
            </div>

            {/* Location Rows */}
            <div className="space-y-4">
              {LOCATIONS.map((loc) => (
                <div
                  key={loc.id}
                  className="group border border-black/15 p-5 bg-white hover:border-black hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between font-mono text-xs text-black/50 mb-1">
                    <span className="font-bold">{loc.code}</span>
                    <span>{loc.district}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-bold uppercase group-hover:text-[#D58C3D] transition-colors">
                        {loc.name}
                      </p>
                      <p className="text-xs text-black/70 font-mono mt-0.5">{loc.address}</p>
                    </div>
                    <a
                      href={loc.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#070707] font-bold uppercase tracking-wider hover:text-[#D58C3D] self-start sm:self-auto"
                    >
                      MAP & DIRECTIONS →
                    </a>
                  </div>
                  <div className="flex items-center justify-between border-t border-black/10 pt-2 mt-3 font-mono text-[11px] text-black/60">
                    <span className="text-[#D58C3D] font-bold">{loc.hours}</span>
                    <span>{loc.seating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Architectural Clock Face + Centered 3D Iced Latte */}
          <div className="lg:col-span-6 relative h-[500px] md:h-[620px] flex items-center justify-center">
            {/* Architectural Clock Ring */}
            <div className="relative w-[340px] h-[340px] md:w-[460px] md:h-[460px] rounded-full border border-black/15 bg-white shadow-2xl flex items-center justify-center">
              {/* Hour Numbers 1 to 12 along the circumference */}
              {Array.from({ length: 12 }).map((_, i) => {
                const hour = i + 1;
                const angleRad = ((hour * 30 - 90) * Math.PI) / 180;
                const radiusPercent = 42; // percentage from center
                const x = 50 + radiusPercent * Math.cos(angleRad);
                const y = 50 + radiusPercent * Math.sin(angleRad);

                return (
                  <span
                    key={hour}
                    className="absolute font-mono text-xs font-bold text-black/60 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
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
