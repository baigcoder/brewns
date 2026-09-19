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
      className="menu-section"
    >
      <div className="container-max">
        {/* Editorial Section Header */}
        <div className="menu-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>//</span>
              <p className="t-eyebrow-dark">OUR MENU</p>
            </div>
            <h2 className="t-headline">FAVORITES MADE DAILY</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
            <p className="t-lede-dark" style={{ maxWidth: '28rem' }}>
              Quality microlot beans, hand-laminated viennoiserie, and dialed espresso drinks. Crafted fresh every morning.
            </p>
            <a
              href="#shop"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#070707',
              }}
            >
              <span>VIEW COMPLETE ROASTS & DRINKS</span>
              <span>→</span>
            </a>
          </div>
        </div>

        {/* 4 Featured Cards Grid */}
        <div className="cards-grid">
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
