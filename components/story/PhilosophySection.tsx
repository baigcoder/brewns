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
      className="relative py-32 px-6 md:px-12 bg-[#070707] text-white overflow-hidden border-t border-white/10"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Eyebrow & Large Display Statement */}
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#D58C3D] font-mono text-sm font-bold">//</span>
            <p className="t-eyebrow">OUR PHILOSOPHY</p>
          </div>
          <h2 className="t-display text-4xl sm:text-5xl md:text-6xl font-bold uppercase tracking-tight text-white mb-6">
            {STORY_DATA.headline}
          </h2>
          <p className="t-lede max-w-2xl text-white/80">
            {STORY_DATA.lede}
          </p>
        </div>

        {/* 3D Drifting Bean Field Scene Container */}
        <div className="relative w-full h-96 md:h-[480px] mb-16 border border-white/15 bg-[#0E0D0C]/70 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 z-0">
            <BeanFieldScene />
          </div>

          {/* Overlay Tag */}
          <div className="absolute top-4 left-4 z-10 font-mono text-[10px] tracking-widest text-white/50 uppercase">
            [INSTANCED 3D BEAN FIELD ATMOSPHERE · TILTED CUP]
          </div>

          <div className="absolute bottom-4 right-4 z-10 font-mono text-[10px] tracking-widest text-[#D58C3D] uppercase">
            TOUCH / DRAG INTERACTIVE DEPTH
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16">
          {STORY_DATA.pillars.map((pillar, i) => (
            <article
              key={pillar.title}
              className="border border-white/15 bg-[#0E0D0C] p-6 md:p-8 flex flex-col justify-between hover:border-white/40 transition-colors"
            >
              <div>
                <p className="font-mono text-xs text-[#D58C3D] mb-4">0{i + 1} / PILLAR</p>
                <h3 className="font-mono font-bold text-base uppercase mb-3 text-white">
                  {pillar.title}
                </h3>
                <p className="text-white/70 text-xs leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Brand Quotes Statement Row */}
        <div className="border-t border-white/15 pt-8 flex flex-wrap items-center justify-between gap-6 font-mono text-xs uppercase tracking-widest text-white/60">
          {STORY_DATA.quotes.map((quote, idx) => (
            <div key={quote} className="flex items-center gap-3">
              <span className="status-dot" />
              <span className="text-white font-bold">{quote}</span>
              {idx < STORY_DATA.quotes.length - 1 && (
                <span className="hidden md:inline text-white/20 ml-6">/</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
