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
    <div ref={containerRef} className="thermal-printer-container">
      {/* 1. Metallic Printer Housing Slot Strip */}
      <div className="thermal-printer-head">
        {/* Metal Status Light & Brand Stamp */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.35rem' }}>
          <span style={{ letterSpacing: '0.12em' }}>EPSON TM-T88VI THERMAL</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
            <span className="status-dot" style={{ width: '0.35rem', height: '0.35rem' }} />
            FEEDING
          </span>
        </div>

        {/* Paper Discharge Slot */}
        <div style={{ width: '100%', height: '0.625rem', backgroundColor: '#050403', borderRadius: '9999px', border: '1px solid #16120E', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)' }}>
          <div style={{ width: '82%', height: '2px', backgroundColor: '#423329' }} />
        </div>
      </div>

      {/* 2. Feeding Window with Overflow Hidden */}
      <div className="thermal-feed-viewport">
        <div
          style={{
            transform: `translateY(${currentTranslateY}px)`,
            transition: 'transform 0.08s ease-out',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Receipt data={SAMPLE_RECEIPT} progress={feedProgress} />
        </div>
      </div>

      {/* 3. Interactive Order Action Button below printer */}
      <div style={{ marginTop: '1rem', position: 'relative', zIndex: 30 }}>
        <button
          onClick={onOrderClick}
          className="btn-primary"
          style={{
            backgroundColor: 'var(--accent-amber)',
            color: '#ffffff',
            boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
          }}
        >
          PRINT YOUR ORDER NOW →
        </button>
      </div>
    </div>
  );
}
