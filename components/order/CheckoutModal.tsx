'use client';

import React, { useState } from 'react';
import { SAMPLE_RECEIPT } from '@/data/receipt';
import { Receipt } from './Receipt';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: () => void;
}

export function CheckoutModal({ isOpen, onClose, onOrderPlaced }: CheckoutModalProps) {
  const [step, setStep] = useState<'details' | 'printing'>('details');
  const [location, setLocation] = useState('139 Coffee Street (Mission)');
  const [customerName, setCustomerName] = useState('Guest');

  if (!isOpen) return null;

  const handleConfirmOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('printing');
    setTimeout(() => {
      onOrderPlaced();
    }, 2800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0E0D0C] text-white border border-white/20 p-6 md:p-10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 font-mono text-xs text-white/50 hover:text-white p-2 border border-white/10"
          aria-label="Close checkout modal"
        >
          [ESC] ✕
        </button>

        {step === 'details' ? (
          <form onSubmit={handleConfirmOrder} className="space-y-6">
            <div>
              <p className="font-mono text-xs text-[#D58C3D] uppercase tracking-widest mb-1">
                // ORDER AHEAD CONFIRMATION
              </p>
              <h2 id="checkout-title" className="font-mono text-2xl font-bold uppercase">
                SCHEDULE PICKUP
              </h2>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-white/60 mb-1.5 uppercase">YOUR NAME / CALL-OUT</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 p-3 text-white focus:outline-none focus:border-[#D58C3D]"
                  placeholder="e.g. Maya"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1.5 uppercase">SELECT ATELIER COUNTER</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#161513] border border-white/20 p-3 text-white focus:outline-none focus:border-[#D58C3D]"
                >
                  <option>139 Coffee Street (Mission District)</option>
                  <option>310 Valencia Street (Valencia Corridor)</option>
                  <option>56 Columbus Avenue (Jackson Square)</option>
                </select>
              </div>

              <div className="p-4 border border-white/10 bg-white/5 space-y-1">
                <p className="text-[#D58C3D] font-bold">● ESTIMATED TIME: READY IN 12 MINUTES</p>
                <p className="text-white/60 text-[11px]">
                  Extraction scheduled to pour as you arrive. Skip the line and show your receipt number at the pickup counter.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#D58C3D] text-white font-mono text-xs font-bold uppercase tracking-widest py-4 hover:bg-white hover:text-black transition-colors"
            >
              CONFIRM & PRINT RECEIPT →
            </button>
          </form>
        ) : (
          <div className="text-center py-6 space-y-6">
            <div className="flex items-center justify-center gap-2 font-mono text-xs text-[#D58C3D]">
              <span className="w-2 h-2 rounded-full bg-[#D58C3D] animate-ping" />
              <span>TRANSMITTING TO ATELIER PRINTER...</span>
            </div>

            <div className="max-w-[280px] mx-auto animate-in slide-in-from-bottom duration-700">
              <Receipt data={SAMPLE_RECEIPT} progress={1} />
            </div>

            <p className="font-mono text-xs text-white/70">
              Order confirmed for <span className="font-bold text-white">{customerName}</span>. See you shortly!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
