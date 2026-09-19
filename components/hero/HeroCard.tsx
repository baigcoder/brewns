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
      className="hero-card-floating"
      style={{
        position: 'absolute',
        right: '1rem',
        top: '0.75rem',
        zIndex: 20,
        pointerEvents: 'none',
        opacity: hoveredObject ? 1 : 0.85,
        transform: hoveredObject ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        className="glass-panel"
        style={{
          padding: '1rem',
          minWidth: '190px',
          color: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--border-dark)',
        }}
      >
        <p className="font-mono" style={{ fontSize: '0.625rem', letterSpacing: '0.12em', color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
          <span style={{ opacity: 0.6 }}>//</span> {cardData.eyebrow}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-dark)', paddingBottom: '0.5rem' }}>
          <p className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            {cardData.name}
          </p>
          <p className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
            {cardData.price}
          </p>
        </div>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--fg-muted-light)' }}>
          {cardData.meta.map((m, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '0.25rem', height: '0.25rem', backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: '9999px' }} />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
