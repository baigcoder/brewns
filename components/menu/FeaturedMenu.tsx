'use client';

import React from 'react';
import { FEATURED_MENU, type MenuItem } from '@/data/menu';
import { MenuCard } from './MenuCard';

interface FeaturedMenuProps {
  onAddToCart: (item: MenuItem) => void;
}

export function FeaturedMenu({ onAddToCart }: FeaturedMenuProps) {
  return (
    <section
      id="menu"
      aria-label="Favorites Made Daily"
      className="relative py-28 px-6 md:px-12 bg-[#F1F1EF] text-[#070707] transition-colors duration-500 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 border-b border-black/15 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#D58C3D] font-mono text-sm font-bold">//</span>
              <p className="t-eyebrow-dark">OUR MENU</p>
            </div>
            <h2 className="t-headline">FAVORITES MADE DAILY</h2>
          </div>

          <div className="flex flex-col md:items-end gap-3">
            <p className="t-lede-dark max-w-md md:text-right">
              Quality microlot beans, hand-laminated viennoiserie, and dialed espresso drinks. Crafted fresh every morning.
            </p>
            <a
              href="#shop"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#070707] hover:text-[#D58C3D] transition-colors"
            >
              <span>VIEW COMPLETE ROASTS & DRINKS</span>
              <span>→</span>
            </a>
          </div>
        </div>

        {/* 4 Featured Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {FEATURED_MENU.map((item, index) => (
            <MenuCard
              key={item.id}
              item={item}
              index={index}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
