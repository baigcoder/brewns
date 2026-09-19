'use client';

import React, { useState } from 'react';
import type { Product } from '@/data/products';

interface ProductCardProps {
  product: Product;
  index: number;
  onOpenModal: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export function ProductCard({ product, index, onOpenModal, onQuickAdd }: ProductCardProps) {
  const [added, setAdded] = useState(false);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article
      onClick={() => onOpenModal(product)}
      className="product-card"
      style={{
        gridColumn: product.featured ? 'span 2' : undefined,
      }}
    >
      <div>
        {/* Card Header Index & Tag with explicit separation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700 }}>0{index + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ textTransform: 'uppercase', fontSize: '0.6875rem', color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.1em' }}>
              {product.category}
            </span>
            {product.tag && (
              <>
                <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>·</span>
                <span className="product-tag-pill">
                  {product.tag}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Product Visual Container */}
        <div
          style={{
            height: '180px',
            width: '100%',
            backgroundColor: '#161513',
            border: '1px solid var(--border-dark)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ width: '3rem', height: '3rem', margin: '0 auto 0.5rem', borderRadius: '9999px', border: '1px solid rgba(213, 140, 61, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-amber)', backgroundColor: 'rgba(213, 140, 61, 0.08)' }}>
              {product.modelType === 'bag' ? 'BAG' : product.modelType === 'cup' ? 'CUP' : 'ICED'}
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'rgba(255, 255, 255, 0.65)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {product.meta}
            </p>
          </div>

          <span style={{ position: 'absolute', bottom: '0.5rem', right: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-amber)' }}>
            CLICK TO CONFIGURE →
          </span>
        </div>

        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem', color: '#ffffff' }}>
          {product.name}
        </h3>

        <p style={{ color: 'var(--fg-muted-light)', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: '1rem' }}>
          {product.description}
        </p>

        {/* Tasting Notes as individual separated tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1.5rem' }}>
          {product.notes.map((note) => (
            <span
              key={note}
              className="tasting-pill-dark"
            >
              {note}
            </span>
          ))}
        </div>
      </div>

      {/* Card Footer: Price & Add Button */}
      <div style={{ borderTop: '1px solid var(--border-dark)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
        <div>
          <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.625rem', marginRight: '0.35rem' }}>FROM</span>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', color: '#ffffff' }}>
            ${product.price.toFixed(2)}
          </span>
        </div>

        <button
          onClick={handleQuickAdd}
          className="btn-primary"
          style={{
            padding: '0.5rem 1.15rem',
            fontSize: '0.6875rem',
            letterSpacing: '0.08em',
            backgroundColor: added ? 'var(--accent-amber)' : '#ffffff',
            color: added ? '#ffffff' : '#070707',
          }}
          aria-label={`Add ${product.name} to bag`}
        >
          {added ? '✓ ADDED' : '+ ADD'}
        </button>
      </div>
    </article>
  );
}
