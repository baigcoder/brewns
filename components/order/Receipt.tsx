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
    <div className="relative w-full max-w-[340px] select-none filter drop-shadow-2xl">
      {/* Main Thermal Receipt Paper Body */}
      <div
        className="bg-[#F4F1EB] text-[#11110F] font-mono p-6 pb-2 transition-all"
        style={{
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Header Branding */}
        <div className="text-center border-b border-dashed border-black/30 pb-4 mb-4">
          <p className="font-bold text-sm tracking-widest uppercase">{data.brandName}</p>
          <p className="text-[10px] text-black/60 tracking-wider mt-0.5">{data.subhead}</p>
          <p className="text-[10px] text-black/50 mt-1">{data.location}</p>
        </div>

        {/* Order Meta Row */}
        <div className="flex justify-between items-center text-xs text-black/70 border-b border-dashed border-black/20 pb-3 mb-4">
          <span className="font-bold">{data.orderNumber}</span>
          <span className="text-[11px]">{data.date} · {data.time}</span>
        </div>

        {/* Item Rows */}
        <div className="space-y-3 mb-4 text-xs">
          {data.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start gap-3">
              <div>
                <p className="font-bold">
                  {item.qty}x {item.name}
                </p>
                {item.notes && (
                  <p className="text-[10px] text-black/50 mt-0.5">{item.notes}</p>
                )}
              </div>
              <span className="font-bold whitespace-nowrap">
                ${(item.qty * item.price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals Calculation */}
        <div className="border-t border-dashed border-black/30 pt-3 space-y-1 text-xs mb-4">
          <div className="flex justify-between text-black/60 text-[11px]">
            <span>SUBTOTAL</span>
            <span>${(data.total - data.tax - data.tip).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-black/60 text-[11px]">
            <span>SALES TAX (8.625%)</span>
            <span>${data.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-black/60 text-[11px]">
            <span>BARISTA TIP</span>
            <span>${data.tip.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-black/20 pt-2 text-black">
            <span>TOTAL PAID</span>
            <span>${data.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Status / Order Note */}
        <div className="border-t border-dashed border-black/20 py-2.5 my-2 text-center">
          <p className="text-[10px] font-bold text-[#D58C3D] tracking-wider uppercase">
            ● {data.status}
          </p>
        </div>

        {/* Barcode Section */}
        <div className="my-4 text-center">
          <div className="flex justify-center items-end h-9 gap-[2px] mb-1">
            {barcodeBars.map((w, i) => (
              <span
                key={i}
                className="bg-[#11110F] inline-block"
                style={{
                  width: `${w}px`,
                  height: `${22 + ((i * 11) % 14)}px`,
                  transform: `scaleY(${Math.min(1, progress * 1.25)})`,
                  transformOrigin: 'bottom',
                  transition: 'transform 0.2s ease-out',
                }}
              />
            ))}
          </div>
          <p className="text-[9px] tracking-widest text-black/60 uppercase">
            *VELDT-{data.orderNumber.replace(/\D/g, '')}-SF*
          </p>
        </div>

        {/* Footer Link & Thanks */}
        <div className="text-center pt-2 pb-1 border-t border-dashed border-black/20">
          <p className="text-[8px] tracking-wider text-black/50 leading-relaxed mb-1">
            {data.footerNote}
          </p>
          <p className="text-[9px] font-bold tracking-widest text-black/70">
            {data.webUrl}
          </p>
        </div>
      </div>

      {/* Procedural Torn Paper Edge SVG */}
      <svg
        viewBox="0 0 340 12"
        className="w-full h-3 block -mt-[1px]"
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
