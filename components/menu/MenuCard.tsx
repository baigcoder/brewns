'use client';

import React, { useRef, useState, useEffect } from 'react';
import type { MenuItem } from '@/data/menu';

interface MenuCardProps {
  item: MenuItem;
  index: number;
  onAddToCart: (item: MenuItem) => void;
}

export function MenuCard({ item, index, onAddToCart }: MenuCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rx: 0, ry: 0, px: 0, py: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isTouch || !cardRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
    const dy = Math.max(-1, Math.min(1, (y / rect.height) * 2 - 1));

    setTransform({
      rx: -dy * 5, // rotateX in degrees
      ry: dx * 5,  // rotateY in degrees
      px: dx * 10, // parallax image X
      py: dy * 10, // parallax image Y
    });
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setTransform({ rx: 0, ry: 0, px: 0, py: 0 });
  };

  return (
    <div
      ref={cardRef}
      onPointerEnter={() => setIsHovered(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="perspective-1000 select-none"
    >
      <article
        className="group relative border border-black/15 bg-white p-6 md:p-7 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-xl hover:border-black/40"
        style={{
          transform: `perspective(800px) rotateX(${transform.rx}deg) rotateY(${transform.ry}deg) translateZ(${isHovered ? 8 : 0}px)`,
          transition: isHovered ? 'transform 0.08s ease-out, box-shadow 0.3s ease' : 'transform 0.5s ease-out, box-shadow 0.3s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        <div>
          {/* Top Index & Category */}
          <div className="flex items-center justify-between font-mono text-xs text-black/50 mb-6">
            <span className="font-bold">0{index + 1}</span>
            <span className="uppercase tracking-widest">{item.category}</span>
          </div>

          {/* Visual Container with Multi-layer Parallax */}
          <div className="relative h-48 w-full bg-[#F4F1EB] flex items-center justify-center mb-6 overflow-hidden border border-black/5">
            {/* Visual SVG Graphic representing the drink */}
            <div
              className="w-24 h-24 relative flex items-center justify-center transition-transform duration-100 ease-out"
              style={{
                transform: `translate3d(${transform.px}px, ${transform.py}px, 20px)`,
              }}
            >
              {/* Geometric Drink Silhouette */}
              <div className="relative w-16 h-20 border-2 border-black/80 flex flex-col justify-end p-1 rounded-b-md overflow-hidden bg-white/60">
                <div
                  className="w-full bg-[#2A1A0F] rounded-b-sm"
                  style={{
                    height: index === 0 ? '40%' : index === 1 ? '70%' : index === 2 ? '85%' : '60%',
                  }}
                />
                <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#D58C3D]" />
              </div>
            </div>

            {/* Subtle floating specs for visual depth */}
            <div className="absolute bottom-2 right-3 font-mono text-[9px] text-black/40 tracking-wider">
              {item.specs}
            </div>
          </div>

          <h3 className="font-mono font-bold text-sm tracking-wide uppercase mb-2 text-[#070707]">
            {item.name}
          </h3>

          <p className="text-black/70 text-xs leading-relaxed mb-4">
            {item.description}
          </p>

          {/* Tasting Notes */}
          {item.notes && (
            <div className="flex flex-wrap gap-1 mb-4">
              {item.notes.map((note) => (
                <span
                  key={note}
                  className="font-mono text-[9px] px-1.5 py-0.5 bg-[#F4F1EB] text-black/60 border border-black/5"
                >
                  {note}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Row */}
        <div className="border-t border-black/10 pt-4 flex items-center justify-between font-mono text-xs">
          <span className="font-bold text-base text-[#070707]">
            ${item.price.toFixed(2)}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(item);
            }}
            className="group/btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#070707] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#D58C3D] transition-colors duration-200"
            aria-label={`Order ${item.name}`}
          >
            <span>+ ORDER</span>
            <span className="group-hover/btn:translate-x-0.5 transition-transform duration-150">→</span>
          </button>
        </div>
      </article>
    </div>
  );
}
