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
      className={`group relative border border-white/15 bg-[#0E0D0C] p-6 md:p-8 flex flex-col justify-between cursor-pointer hover:border-white/40 transition-all duration-300 ${
        product.featured ? 'lg:col-span-2' : ''
      }`}
    >
      <div>
        {/* Card Header Index & Tag */}
        <div className="flex items-center justify-between font-mono text-xs text-white/50 mb-4">
          <span className="font-bold">0{index + 1}</span>
          <div className="flex items-center gap-2">
            <span className="uppercase text-[10px] text-white/40">{product.category}</span>
            {product.tag && (
              <span className="px-2 py-0.5 border border-[#D58C3D] text-[#D58C3D] text-[9px] uppercase tracking-wider">
                {product.tag}
              </span>
            )}
          </div>
        </div>

        {/* Product Visual Container */}
        <div className="h-44 md:h-52 w-full bg-[#161513] border border-white/5 flex flex-col items-center justify-center mb-6 relative overflow-hidden group-hover:bg-[#1C1A17] transition-colors">
          <div className="text-center p-4">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full border border-[#D58C3D]/30 flex items-center justify-center font-mono text-xs text-[#D58C3D]">
              {product.modelType === 'bag' ? 'BAG' : product.modelType === 'cup' ? 'CUP' : 'ICED'}
            </div>
            <p className="font-mono text-[11px] text-white/60 tracking-wider">
              {product.meta}
            </p>
          </div>

          <span className="absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-widest text-[#D58C3D] opacity-0 group-hover:opacity-100 transition-opacity">
            CLICK TO CONFIGURE →
          </span>
        </div>

        <h3 className="font-mono text-base md:text-lg font-bold uppercase mb-1 text-white group-hover:text-[#D58C3D] transition-colors">
          {product.name}
        </h3>

        <p className="text-white/70 text-xs leading-relaxed mb-4 line-clamp-2">
          {product.description}
        </p>

        {/* Tasting Notes */}
        <div className="flex flex-wrap gap-1 mb-6">
          {product.notes.map((note) => (
            <span
              key={note}
              className="font-mono text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 text-white/60"
            >
              {note}
            </span>
          ))}
        </div>
      </div>

      {/* Card Footer: Price & Add Button */}
      <div className="border-t border-white/10 pt-4 flex items-center justify-between font-mono text-xs">
        <div>
          <span className="text-white/40 text-[10px] mr-1">FROM</span>
          <span className="font-bold text-base text-white">
            ${product.price.toFixed(2)}
          </span>
        </div>

        <button
          onClick={handleQuickAdd}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            added
              ? 'bg-[#D58C3D] text-white'
              : 'bg-white text-black hover:bg-[#D58C3D] hover:text-white'
          }`}
          aria-label={`Add ${product.name} to bag`}
        >
          {added ? '✓ ADDED' : '+ ADD'}
        </button>
      </div>
    </article>
  );
}
