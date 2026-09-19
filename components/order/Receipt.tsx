'use client';

import React from 'react';
import type { ReceiptData } from '@/data/receipt';

interface ReceiptProps {
  data: ReceiptData;
  progress: number; // 0 to 1
}

export function Receipt({ data, progress }: ReceiptProps) {
  // Barcode pattern calculation
  const barcodeBars = [
    2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 1, 2, 4, 1, 1, 2, 1, 3, 1,
    1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2, 1, 1, 3, 2, 4, 1, 2,
  ];

  return (
    <div className="receipt-paper-wrapper">
      {/* Main Thermal Receipt Paper Body */}
      <div className="receipt-paper-body">
        {/* Header Branding */}
        <div style={{ textAlign: 'center', borderBottom: '1px dashed rgba(0,0,0,0.25)', paddingBottom: '0.875rem', marginBottom: '0.875rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {data.brandName}
          </p>
          <p style={{ fontSize: '0.625rem', color: 'rgba(0,0,0,0.6)', letterSpacing: '0.08em', marginTop: '0.125rem' }}>
            {data.subhead}
          </p>
          <p style={{ fontSize: '0.625rem', color: 'rgba(0,0,0,0.5)', marginTop: '0.25rem' }}>
            {data.location}
          </p>
        </div>

        {/* Order Meta Row */}
        <div className="receipt-row-between" style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.7)', borderBottom: '1px dashed rgba(0,0,0,0.2)', paddingBottom: '0.625rem', marginBottom: '0.875rem' }}>
          <span style={{ fontWeight: 700 }}>{data.orderNumber}</span>
          <span style={{ fontSize: '0.6875rem' }}>{data.date} · {data.time}</span>
        </div>

        {/* Item Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '0.875rem', fontSize: '0.75rem' }}>
          {data.items.map((item, idx) => (
            <div key={idx} className="receipt-row-between" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700 }}>
                  {item.qty}x {item.name}
                </p>
                {item.notes && (
                  <p style={{ fontSize: '0.625rem', color: 'rgba(0,0,0,0.5)', marginTop: '0.125rem' }}>
                    {item.notes}
                  </p>
                )}
              </div>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                ${(item.qty * item.price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals Calculation */}
        <div style={{ borderTop: '1px dashed rgba(0,0,0,0.25)', paddingTop: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.6875rem', marginBottom: '0.875rem' }}>
          <div className="receipt-row-between" style={{ color: 'rgba(0,0,0,0.65)' }}>
            <span>SUBTOTAL</span>
            <span>${(data.total - data.tax - data.tip).toFixed(2)}</span>
          </div>
          <div className="receipt-row-between" style={{ color: 'rgba(0,0,0,0.65)' }}>
            <span>SALES TAX (8.625%)</span>
            <span>${data.tax.toFixed(2)}</span>
          </div>
          <div className="receipt-row-between" style={{ color: 'rgba(0,0,0,0.65)' }}>
            <span>BARISTA TIP</span>
            <span>${data.tip.toFixed(2)}</span>
          </div>
          <div className="receipt-row-between" style={{ fontSize: '0.875rem', fontWeight: 700, borderTop: '1px solid rgba(0,0,0,0.25)', paddingTop: '0.5rem', color: '#070707' }}>
            <span>TOTAL PAID</span>
            <span>${data.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Status / Order Note */}
        <div style={{ borderTop: '1px dashed rgba(0,0,0,0.2)', padding: '0.5rem 0', margin: '0.5rem 0', textAlign: 'center' }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ● {data.status}
          </p>
        </div>

        {/* Barcode Section */}
        <div style={{ margin: '0.75rem 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '2.25rem', gap: '2px', marginBottom: '0.35rem', overflow: 'hidden' }}>
            {barcodeBars.map((w, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#11110F',
                  width: `${w}px`,
                  height: `${20 + ((i * 7) % 12)}px`,
                  transform: `scaleY(${Math.min(1, progress * 1.25)})`,
                  transformOrigin: 'bottom',
                  transition: 'transform 0.2s ease-out',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: '0.5625rem', letterSpacing: '0.12em', color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase' }}>
            *VELDT-{data.orderNumber.replace(/\D/g, '')}-SF*
          </p>
        </div>

        {/* Footer Link & Thanks */}
        <div style={{ textAlign: 'center', paddingTop: '0.5rem', paddingBottom: '0.25rem', borderTop: '1px dashed rgba(0,0,0,0.2)' }}>
          <p style={{ fontSize: '0.5rem', letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', lineHeight: 1.4, marginBottom: '0.25rem' }}>
            {data.footerNote}
          </p>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0,0,0,0.7)' }}>
            {data.webUrl}
          </p>
        </div>
      </div>

      {/* Procedural Torn Paper Edge SVG */}
      <svg
        viewBox="0 0 340 12"
        style={{ width: '100%', height: '12px', display: 'block', marginTop: '-1px' }}
        preserveAspectRatio="none"
      >
        <path
          d="M 0 0 L 340 0 L 332 10 L 324 0 L 316 10 L 308 0 L 300 10 L 292 0 L 284 10 L 276 0 L 268 10 L 260 0 L 252 10 L 244 0 L 236 10 L 228 0 L 220 10 L 212 0 L 204 10 L 196 0 L 188 10 L 180 0 L 172 10 L 164 0 L 156 10 L 148 0 L 140 10 L 132 0 L 124 10 L 116 0 L 108 10 L 100 0 L 92 10 L 84 0 L 76 10 L 68 0 L 60 10 L 52 0 L 44 10 L 36 0 L 28 10 L 20 0 L 12 10 L 4 0 L 0 10 Z"
          fill="#F4F1EB"
        />
      </svg>
    </div>
  );
}
