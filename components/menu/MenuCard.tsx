'use client';

import React, { useRef, useState, useEffect } from 'react';
import type { MenuItem } from '@/data/menu';

interface MenuCardProps {
  item: MenuItem;
  index: number;
  onAddToCart: (item: MenuItem) => void;
}

export function MenuCard({ item, index, onAddToCart }: MenuCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rx: 0, ry: 0, px: 0, py: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isTouch || !cardRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
    const dy = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));

    setTransform({
      rx: -dy * 5, // rotateX in degrees
      ry: dx * 5,  // rotateY in degrees
      px: dx * 10, // parallax image X
      py: dy * 10, // parallax image Y
    });
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setTransform({ rx: 0, ry: 0, px: 0, py: 0 });
  };

  return (
    <div
      ref={cardRef}
      onPointerEnter={() => setIsHovered(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: '1000px', userSelect: 'none' }}
    >
      <article
        className="menu-card"
        style={{
          transform: `perspective(800px) rotateX(${transform.rx}deg) rotateY(${transform.ry}deg) translateZ(${isHovered ? 8 : 0}px)`,
          transition: isHovered ? 'transform 0.08s ease-out, box-shadow 0.3s ease' : 'transform 0.5s ease-out, box-shadow 0.3s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        <div>
          {/* Top Index & Category with explicit separation */}
          <div className="card-taxonomy-row">
            <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>0{index + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: 'rgba(7, 7, 7, 0.35)' }}>/</span>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {item.category}
              </span>
            </div>
          </div>

          {/* Visual Container with Multi-layer Parallax */}
          <div
            style={{
              position: 'relative',
              height: '180px',
              width: '100%',
              backgroundColor: '#F4F1EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              overflow: 'hidden',
              border: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            {/* Visual SVG Graphic representing the drink */}
            <div
              style={{
                width: '6rem',
                height: '6rem',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s ease-out',
                transform: `translate3d(${transform.px}px, ${transform.py}px, 20px)`,
              }}
            >
              {/* Geometric Drink Silhouette */}
              <div
                style={{
                  position: 'relative',
                  width: '4rem',
                  height: '5rem',
                  border: '2px solid rgba(0, 0, 0, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '0.25rem',
                  borderRadius: '0 0 6px 6px',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    backgroundColor: '#2A1A0F',
                    borderRadius: '0 0 2px 2px',
                    height: index === 0 ? '40%' : index === 1 ? '70%' : index === 2 ? '85%' : '60%',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    left: '0.5rem',
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--accent-amber)',
                  }}
                />
              </div>
            </div>

            {/* Subtle floating specs for visual depth */}
            <div
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                right: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.5625rem',
                color: 'rgba(0, 0, 0, 0.45)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {item.specs}
            </div>
          </div>

          <h3 style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.5rem', color: '#070707' }}>
            {item.name}
          </h3>

          <p style={{ color: 'rgba(7, 7, 7, 0.72)', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: '1rem' }}>
            {item.description}
          </p>

          {/* Tasting Notes as individual separated tags */}
          {item.notes && (
            <div className="card-notes-group">
              {item.notes.map((note) => (
                <span
                  key={note}
                  className="tasting-pill-light"
                >
                  {note}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Row */}
        <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.1)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#070707' }}>
            ${item.price.toFixed(2)}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(item);
            }}
            className="btn-primary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.6875rem',
              letterSpacing: '0.08em',
              gap: '0.35rem',
            }}
            aria-label={`Order ${item.name}`}
          >
            <span>+ ORDER</span>
            <span>→</span>
          </button>
        </div>
      </article>
    </div>
  );
}
