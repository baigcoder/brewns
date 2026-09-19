'use client';

import React, { useState } from 'react';
import { PRODUCTS, type Product } from '@/data/products';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';

interface ShopSectionProps {
  onAddToCart: (product: Product, options?: Record<string, number>, qty?: number) => void;
}

const CATEGORIES = [
  { key: 'all', label: 'ALL' },
  { key: 'beans', label: 'BEANS' },
  { key: 'drinks', label: 'DRINKS' },
  { key: 'bakery', label: 'BAKERY' },
  { key: 'merch', label: 'GIFTS' },
];

export function ShopSection({ onAddToCart }: ShopSectionProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeProductModal, setActiveProductModal] = useState<Product | null>(null);

  const filteredProducts = activeCategory === 'all'
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === activeCategory);

  return (
    <section
      id="shop"
      aria-label="Coffee Products and Subscriptions"
      className="shop-section"
    >
      <div className="container-max">
        {/* Section Header */}
        <div className="shop-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>//</span>
              <p className="t-eyebrow">THE SHOP</p>
            </div>
            <h2 className="t-headline">TAKE VELDT HOME.</h2>
          </div>

          <div>
            <p className="t-lede" style={{ maxWidth: '28rem', opacity: 0.85 }}>
              BEANS ROASTED WEEKLY IN SAN FRANCISCO. ORDER AHEAD FOR IMMEDIATE PICKUP OR SUBSCRIBE FOR FRESH BATCH ROASTS DELIVERED TO YOUR DOOR.
            </p>
          </div>
        </div>

        {/* Filter Tabs & Catalog Counter */}
        <div className="shop-filter-bar">
          <div className="shop-tabs-group">
            {CATEGORIES.map((cat) => {
              const count = cat.key === 'all'
                ? PRODUCTS.length
                : PRODUCTS.filter((p) => p.category === cat.key).length;
              const isActive = activeCategory === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`shop-tab-btn ${isActive ? 'active' : ''}`}
                  aria-selected={isActive}
                  role="tab"
                >
                  <span>{cat.label}</span>
                  <sup style={{ marginLeft: '0.25rem', fontSize: '0.625rem', opacity: 0.7 }}>0{count}</sup>
                </button>
              );
            })}
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.12em', color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
            <strong style={{ color: '#fff' }}>{String(filteredProducts.length).padStart(2, '0')}</strong> PRODUCTS AVAILABLE
          </p>
        </div>

        {/* Products Grid */}
        <div className="shop-grid-layout">
          {filteredProducts.map((product, idx) => (
            <ProductCard
              key={product.id}
              product={product}
              index={idx}
              onOpenModal={setActiveProductModal}
              onQuickAdd={(p) => onAddToCart(p)}
            />
          ))}
        </div>
      </div>

      {/* Product Customization Modal */}
      {activeProductModal && (
        <ProductModal
          product={activeProductModal}
          onClose={() => setActiveProductModal(null)}
          onAddToCart={(p, options, qty) => onAddToCart(p, options, qty)}
        />
      )}
    </section>
  );
}
