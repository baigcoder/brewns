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
      className="order-section"
    >
      <div className="container-max">
        <div className="order-grid">
          {/* Left Column: Copy & Order Guarantees */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>//</span>
                <p className="t-eyebrow">ORDER AHEAD</p>
              </div>
              <h2 className="t-headline">COFFEE FOR RIGHT NOW.</h2>
            </div>

            <p className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--accent-amber)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              WE HANDLE THE CRAFT. YOU HANDLE THE DAY.
            </p>

            <p className="t-lede" style={{ opacity: 0.85 }}>
              We work to one schedule: yours. Order ahead through our digital counter and your cup is poured to meet you the second you walk in. Fast because it is timed to you, not because it is rushed.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-dark)', paddingTop: '1.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--fg-muted-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="status-dot" />
                <span style={{ color: '#fff', fontWeight: 700 }}>TIMED PREORDER RITUAL</span>
              </div>
              <p style={{ opacity: 0.8 }}>
                Pick up at any of our three counters: 139 Coffee Street, 310 Valencia, or 56 Columbus.
              </p>
            </div>
          </div>

          {/* Right Column: Physical Thermal Printer Housing & Feeding Receipt */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ThermalPrinter onOrderClick={onOrderClick} />
          </div>
        </div>
      </div>
    </section>
  );
}
