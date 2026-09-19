'use client';

import React, { useState } from 'react';
import type { Product } from '@/data/products';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, selectedOptions: Record<string, number>, quantity: number) => void;
}

export function ProductModal({ product, onClose, onAddToCart }: ProductModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  // Initialize defaults
  const currentSelections: Record<string, number> = {};
  product.options.forEach((opt) => {
    currentSelections[opt.key] = selectedOptions[opt.key] ?? opt.defaultIndex ?? 0;
  });

  // Calculate dynamic unit price
  let calculatedPrice = product.price;
  product.options.forEach((opt) => {
    const selectedIdx = currentSelections[opt.key];
    const choice = opt.choices[selectedIdx];
    if (choice) calculatedPrice += choice.priceDelta;
  });

  const totalPrice = calculatedPrice * quantity;

  const handleSelectOption = (key: string, idx: number) => {
    setSelectedOptions((prev) => ({ ...prev, [key]: idx }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0E0D0C] text-white border border-white/20 p-6 md:p-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 font-mono text-xs text-white/50 hover:text-white p-2 border border-white/10 hover:border-white/40 transition-colors"
          aria-label="Close product modal"
        >
          [ESC] ✕
        </button>

        {/* Product Category & Tag */}
        <div className="flex items-center gap-3 font-mono text-xs text-white/50 mb-3">
          <span className="text-[#D58C3D]">// {product.category.toUpperCase()}</span>
          {product.tag && (
            <span className="px-2 py-0.5 border border-[#D58C3D] text-[#D58C3D] text-[10px]">
              {product.tag}
            </span>
          )}
        </div>

        {/* Product Title & Price */}
        <h2 id="product-title" className="font-mono text-2xl md:text-3xl font-bold uppercase mb-2">
          {product.name}
        </h2>
        <p className="font-mono text-xl text-[#D58C3D] font-bold mb-4">
          ${calculatedPrice.toFixed(2)}
        </p>

        <p className="text-white/80 text-sm leading-relaxed mb-6 border-b border-white/10 pb-4">
          {product.description}
        </p>

        {/* Customization Options */}
        <div className="space-y-6 mb-8">
          {product.options.map((opt) => (
            <div key={opt.key}>
              <p className="font-mono text-xs uppercase tracking-wider text-white/60 mb-2">
                {opt.label}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {opt.choices.map((choice, idx) => {
                  const isSelected = currentSelections[opt.key] === idx;
                  return (
                    <button
                      key={choice.label}
                      onClick={() => handleSelectOption(opt.key, idx)}
                      className={`p-3 border font-mono text-xs uppercase text-left transition-all ${
                        isSelected
                          ? 'border-[#D58C3D] bg-[#D58C3D]/10 text-white font-bold'
                          : 'border-white/15 text-white/70 hover:border-white/40'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{choice.label}</span>
                        {choice.badge && (
                          <span className="text-[9px] text-[#D58C3D] bg-[#D58C3D]/20 px-1 rounded">
                            {choice.badge}
                          </span>
                        )}
                      </div>
                      {choice.priceDelta !== 0 && (
                        <p className="text-[10px] text-white/50 mt-1">
                          {choice.priceDelta > 0 ? `+${choice.priceDelta.toFixed(2)}` : `${choice.priceDelta.toFixed(2)}`}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quantity and Add to Bag Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/15">
          <div className="flex items-center border border-white/20">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-4 py-2 font-mono hover:bg-white/10 transition-colors"
            >
              -
            </button>
            <span className="px-4 py-2 font-mono text-sm">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-4 py-2 font-mono hover:bg-white/10 transition-colors"
            >
              +
            </button>
          </div>

          <button
            onClick={() => {
              onAddToCart(product, currentSelections, quantity);
              onClose();
            }}
            className="flex-1 bg-[#D58C3D] text-white font-mono text-xs font-bold uppercase tracking-widest py-4 px-6 hover:bg-white hover:text-black transition-colors"
          >
            ADD TO BAG · ${totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
