'use client';

import React, { useRef, useState, useEffect } from 'react';
import { SAMPLE_RECEIPT } from '@/data/receipt';
import { Receipt } from './Receipt';

interface ThermalPrinterProps {
  onOrderClick: () => void;
}

export function ThermalPrinter({ onOrderClick }: ThermalPrinterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [feedProgress, setFeedProgress] = useState(0);

  useEffect(() => {
    // Check reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFeedProgress(1);
      return;
    }

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // When section enters the lower third of the screen, feed starts
      const startTrigger = windowHeight * 0.85;
      const endTrigger = windowHeight * 0.25;

      const progress = Math.max(0, Math.min(1, (startTrigger - rect.top) / (startTrigger - endTrigger)));

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setFeedProgress(eased);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Translate calculation: paper starts tucked inside the slot and feeds out downwards
  const maxFeedTranslate = 420; // pixels of extrusion
  const currentTranslateY = (1 - feedProgress) * -maxFeedTranslate;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm mx-auto flex flex-col items-center">
      {/* 1. Metallic Printer Housing Slot Strip */}
      <div className="relative z-30 w-full max-w-[380px] h-14 bg-gradient-to-b from-[#322822] via-[#201813] to-[#0E0B09] border-t-2 border-b-2 border-[#544033] rounded-t-sm shadow-2xl flex flex-col items-center justify-center px-6">
        {/* Metal Status Light & Brand Stamp */}
        <div className="w-full flex items-center justify-between font-mono text-[9px] text-white/50 mb-1">
          <span className="tracking-widest">EPSON TM-T88VI THERMAL</span>
          <span className="flex items-center gap-1.5 text-[#D58C3D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D58C3D] animate-ping" />
            FEEDING
          </span>
        </div>

        {/* Paper Discharge Slot */}
        <div className="w-full h-2.5 bg-black/95 rounded-full border border-black shadow-inner flex items-center justify-center">
          <div className="w-4/5 h-0.5 bg-[#423329]" />
        </div>
      </div>

      {/* 2. Feeding Window with Overflow Hidden */}
      <div className="relative z-20 w-full overflow-hidden min-h-[480px] flex justify-center pt-0">
        <div
          className="transition-transform duration-75 ease-out"
          style={{
            transform: `translateY(${currentTranslateY}px)`,
          }}
        >
          <Receipt data={SAMPLE_RECEIPT} progress={feedProgress} />
        </div>
      </div>

      {/* 3. Interactive Order Action Button below printer */}
      <div className="mt-4 z-30">
        <button
          onClick={onOrderClick}
          className="bg-[#D58C3D] text-white font-mono text-xs font-bold uppercase tracking-widest px-8 py-3.5 hover:bg-white hover:text-black transition-colors duration-200 shadow-xl"
        >
          PRINT YOUR ORDER NOW →
        </button>
      </div>
    </div>
  );
}
