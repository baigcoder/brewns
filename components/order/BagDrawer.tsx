'use client';

import React, { useEffect } from 'react';

export interface BagItem {
  id: string;
  name: string;
  price: number;
  optionsLabel?: string;
  qty: number;
}

interface BagDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: BagItem[];
  onUpdateQty: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onCheckout: () => void;
}

export function BagDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
}: BagDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.08625;
  const total = subtotal + tax;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bag-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-md h-full bg-[#0E0D0C] text-white border-l border-white/15 p-6 md:p-8 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-white/10 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 id="bag-title" className="font-mono text-xl font-bold uppercase">
              YOUR BAG
            </h2>
            <span className="font-mono text-xs text-[#D58C3D] bg-[#D58C3D]/10 px-2 py-0.5 rounded">
              {items.reduce((acc, i) => acc + i.qty, 0)} ITEMS
            </span>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/40 px-2.5 py-1.5 transition-colors"
            aria-label="Close shopping bag"
          >
            [ESC] ✕
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto py-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="font-mono text-sm text-white/40 uppercase">YOUR BAG IS EMPTY</p>
              <p className="text-xs text-white/60 font-mono max-w-xs mx-auto">
                Explore our featured roasts and daily menu to order ahead for pickup.
              </p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-mono text-sm font-bold uppercase">{item.name}</h3>
                    {item.optionsLabel && (
                      <p className="font-mono text-[10px] text-white/50 mt-0.5">
                        {item.optionsLabel}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm font-bold text-[#D58C3D]">
                    ${(item.price * item.qty).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-2 font-mono text-xs">
                  <div className="flex items-center border border-white/20">
                    <button
                      onClick={() => onUpdateQty(idx, Math.max(1, item.qty - 1))}
                      className="px-2.5 py-1 hover:bg-white/10 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 font-bold">{item.qty}</span>
                    <button
                      onClick={() => onUpdateQty(idx, item.qty + 1)}
                      className="px-2.5 py-1 hover:bg-white/10 transition-colors"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => onRemoveItem(idx)}
                    className="text-white/40 hover:text-red-400 text-[11px] underline underline-offset-2 transition-colors"
                  >
                    REMOVE
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Totals & Checkout */}
        {items.length > 0 && (
          <div className="border-t border-white/15 pt-4 space-y-3">
            <div className="flex justify-between font-mono text-xs text-white/60">
              <span>SUBTOTAL</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-mono text-xs text-white/60">
              <span>ESTIMATED TAX</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-mono text-base font-bold text-white border-t border-white/10 pt-2">
              <span>ESTIMATED TOTAL</span>
              <span className="text-[#D58C3D]">${total.toFixed(2)}</span>
            </div>

            <button
              onClick={() => {
                onClose();
                onCheckout();
              }}
              className="w-full bg-[#D58C3D] text-white font-mono text-xs font-bold uppercase tracking-widest py-4 hover:bg-white hover:text-black transition-colors duration-200 mt-2"
            >
              PROCEED TO ORDER AHEAD →
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
