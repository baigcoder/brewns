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
      className="relative py-28 px-6 md:px-12 bg-[#070707] text-white overflow-hidden border-t border-white/10"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/15 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#D58C3D] font-mono text-sm font-bold">//</span>
              <p className="t-eyebrow">THE SHOP</p>
            </div>
            <h2 className="t-headline">TAKE VELDT HOME.</h2>
          </div>

          <div className="flex flex-col md:items-end gap-2">
            <p className="t-lede max-w-md md:text-right text-white/80">
              BEANS ROASTED WEEKLY IN SAN FRANCISCO. ORDER AHEAD FOR IMMEDIATE PICKUP OR SUBSCRIBE FOR FRESH BATCH ROASTS DELIVERED TO YOUR DOOR.
            </p>
          </div>
        </div>

        {/* Filter Tabs & Catalog Counter */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-4 border-b border-white/10">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const count = cat.key === 'all'
                ? PRODUCTS.length
                : PRODUCTS.filter((p) => p.category === cat.key).length;
              const isActive = activeCategory === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-black font-bold'
                      : 'border border-white/15 text-white/70 hover:border-white/40 hover:text-white'
                  }`}
                  aria-selected={isActive}
                  role="tab"
                >
                  <span>{cat.label}</span>
                  <sup className="ml-1 text-[10px] opacity-70">0{count}</sup>
                </button>
              );
            })}
          </div>

          <p className="font-mono text-xs tracking-widest text-[#D58C3D] uppercase">
            <span className="text-white font-bold">{String(filteredProducts.length).padStart(2, '0')}</span> PRODUCTS AVAILABLE
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
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
