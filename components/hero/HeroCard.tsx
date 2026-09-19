'use client';

import React from 'react';

interface HeroCardProps {
  hoveredObject: 'bag' | 'cup' | null;
}

export function HeroCard({ hoveredObject }: HeroCardProps) {
  const isCup = hoveredObject === 'cup';

  const cardData = isCup
    ? {
        eyebrow: 'IN THE CUP',
        name: 'ATELIER FLAT WHITE',
        price: '$4.80',
        meta: ['6 OZ POUR', 'RISTRETTO DOUBLE', 'ORGANIC STEAMED MILK'],
      }
    : {
        eyebrow: 'IN THE BAG',
        name: 'SLOW ROAST NO. 4',
        price: '$18.00',
        meta: ['250 G', 'WHOLE BEAN', 'HUILA & SIDAMA'],
      };

  return (
    <div
      className="hidden lg:block absolute right-8 top-16 z-20 transition-all duration-300 pointer-events-none"
      style={{
        opacity: hoveredObject ? 1 : 0.85,
        transform: hoveredObject ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
      }}
    >
      <div className="glass-panel p-5 min-w-[240px] text-white shadow-2xl border border-white/20">
        <p className="font-mono text-[10px] tracking-widest text-[#D58C3D] uppercase">
          <span className="opacity-60">//</span> {cardData.eyebrow}
        </p>
        <div className="flex items-baseline justify-between gap-4 mt-2 mb-3 border-b border-white/10 pb-2">
          <p className="font-mono text-sm font-bold tracking-tight uppercase">
            {cardData.name}
          </p>
          <p className="font-mono text-sm text-[#D58C3D] font-bold">
            {cardData.price}
          </p>
        </div>
        <ul className="space-y-1 font-mono text-[10px] text-white/60">
          {cardData.meta.map((m, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 bg-white/40 rounded-full" />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
