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
      className="relative min-h-[100svh] w-full flex flex-col justify-between pt-28 pb-8 px-6 md:px-12 overflow-hidden bg-[#070707] text-white"
    >
      {/* 1. Custom WebGL2 Opalesce Noise Background */}
      <OpalesceShader />

      {/* 2. Main Hero Composition */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto w-full max-w-7xl mx-auto">
        {/* Left Column: Editorial Headline & Copy */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[#D58C3D] font-mono text-sm font-bold">//</span>
            <p className="t-eyebrow tracking-widest text-white/70">
              SPECIALTY COFFEE HOUSE & ROASTERY
            </p>
          </div>

          <div className="relative">
            <h1 className="t-display text-white">
              COFFEE FOR YOUR
              <span className="block font-script text-6xl md:text-8xl lg:text-9xl text-[#D58C3D] normal-case mt-1 ml-4 md:ml-12 drop-shadow-lg">
                moment
              </span>
            </h1>
          </div>

          <p className="t-lede max-w-xl text-white/85">
            CAREFULLY SOURCED HIGH-ALTITUDE MICROLOTS, THOUGHTFULLY ROASTED IN SAN FRANCISCO TO BRING OUT THE VIBRANT SWEETNESS IN EVERY POUR.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#order"
              className="group relative inline-flex items-center gap-3 bg-white text-[#070707] font-mono text-xs font-bold uppercase tracking-wider px-7 py-4 overflow-hidden hover:bg-[#D58C3D] hover:text-white transition-colors duration-300"
            >
              <span>ORDER AHEAD</span>
              <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
            </a>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 border border-white/30 text-white font-mono text-xs uppercase tracking-wider px-7 py-4 hover:border-white transition-colors duration-300"
            >
              EXPLORE MENU
            </a>
          </div>
        </div>

        {/* Right Column: 3D Interactive Coffee Studio */}
        <div className="lg:col-span-5 relative w-full h-[400px] md:h-[540px] flex items-center justify-center">
          <HeroCard hoveredObject={hoveredObject} />
          <div className="w-full h-full relative">
            <CoffeeStudioScene onHoverObject={setHoveredObject} />
          </div>
        </div>
      </div>

      {/* 3. Hero Bottom Metadata Bar */}
      <aside
        aria-label="Hours and Location Information"
        className="relative z-10 w-full max-w-7xl mx-auto border-t border-white/15 pt-5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-white/70 uppercase"
      >
        <div className="flex items-center gap-3">
          <span className="status-dot" />
          <span className="tracking-wider text-white">OPEN DAILY 07:00 – 21:00</span>
        </div>
        <address className="not-italic tracking-wider">
          139 COFFEE STREET, MISSION DISTRICT, SF
        </address>
        <div className="flex items-center gap-4 text-white/60">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            INSTAGRAM
          </a>
          <span>/</span>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            TIKTOK
          </a>
        </div>
      </aside>
    </section>
  );
}
