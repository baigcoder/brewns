'use client';

import React from 'react';
import { ThermalPrinter } from './ThermalPrinter';

interface OrderSectionProps {
  onOrderClick: () => void;
}

export function OrderSection({ onOrderClick }: OrderSectionProps) {
  return (
    <section
      id="order"
      aria-label="Order Ahead Receipt"
      className="relative py-32 px-6 md:px-12 bg-[#0E0D0C] text-white overflow-hidden border-t border-white/10"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Copy & Order Guarantees */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#D58C3D] font-mono text-sm font-bold">//</span>
                <p className="t-eyebrow">ORDER AHEAD</p>
              </div>
              <h2 className="t-headline">COFFEE FOR RIGHT NOW.</h2>
            </div>

            <p className="font-mono text-sm text-[#D58C3D] font-bold uppercase tracking-wider">
              WE HANDLE THE CRAFT. YOU HANDLE THE DAY.
            </p>

            <p className="t-lede text-white/80">
              We work to one schedule: yours. Order ahead through our digital counter and your cup is poured to meet you the second you walk in. Fast because it is timed to you, not because it is rushed.
            </p>

            <div className="space-y-3 border-t border-white/15 pt-6 font-mono text-xs text-white/70">
              <div className="flex items-center gap-3">
                <span className="status-dot" />
                <span className="text-white font-bold">TIMED PREORDER RITUAL</span>
              </div>
              <p className="text-white/60">
                Pick up at any of our three counters: 139 Coffee Street, 310 Valencia, or 56 Columbus.
              </p>
            </div>
          </div>

          {/* Right Column: Physical Thermal Printer Housing & Feeding Receipt */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <ThermalPrinter onOrderClick={onOrderClick} />
          </div>
        </div>
      </div>
    </section>
  );
}
