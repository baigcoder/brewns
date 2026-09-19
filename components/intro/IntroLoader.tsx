'use client';

import React, { useEffect, useState } from 'react';

interface IntroLoaderProps {
  onComplete?: () => void;
}

export function IntroLoader({ onComplete }: IntroLoaderProps) {
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState<'drawing' | 'filling' | 'complete' | 'revealed'>('drawing');
  const [pourProgress, setPourProgress] = useState(0);

  useEffect(() => {
    // Check reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage('revealed');
      onComplete?.();
      return;
    }

    // Step 1: Count up from 0 to 100 while liquid fills
    const startTime = performance.now();
    const duration = 1800; // 1.8 seconds fill duration

    const updateTimer = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      setCount(Math.floor(progress * 100));

      if (progress < 1) {
        requestAnimationFrame(updateTimer);
      } else {
        setStage('complete');
        // Step 2: Pour-away transition after brief hold
        setTimeout(() => {
          const pourStart = performance.now();
          const pourDuration = 600;

          const animatePour = (pourNow: number) => {
            const pElapsed = pourNow - pourStart;
            const pProgress = Math.min(1, pElapsed / pourDuration);
            // Ease in out quart
            const eased = pProgress < 0.5
              ? 8 * pProgress * pProgress * pProgress * pProgress
              : 1 - Math.pow(-2 * pProgress + 2, 4) / 2;

            setPourProgress(eased);

            if (pProgress < 1) {
              requestAnimationFrame(animatePour);
            } else {
              setStage('revealed');
              onComplete?.();
            }
          };
          requestAnimationFrame(animatePour);
        }, 250);
      }
    };

    const animId = requestAnimationFrame(updateTimer);
    return () => cancelAnimationFrame(animId);
  }, [onComplete]);

  if (stage === 'revealed') return null;

  const clipTopPercent = pourProgress * 100;

  return (
    <div
      id="intro-preloader"
      aria-hidden="false"
      className="fixed inset-0 z-[100] flex flex-col justify-between p-6 md:p-10 bg-[#070707] text-white overflow-hidden pointer-events-none"
      style={{
        clipPath: `inset(${clipTopPercent}% 0 0 0)`,
        transition: 'clip-path 0.05s linear',
      }}
    >
      {/* Background radial warmth */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 80% 80%, #2A1A0F 0%, #110B07 45%, #070707 75%)',
        }}
      />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between">
        <p className="font-mono text-xs tracking-widest text-white/50 uppercase">
          <span className="text-[#D58C3D]">//</span> NOW BREWING
        </p>
        <span className="font-mono text-xs text-[#D58C3D] tracking-widest uppercase">
          VELDT ATELIER
        </span>
      </div>

      {/* Center Numeric Counter */}
      <div className="relative z-10">
        <p className="font-mono text-7xl md:text-9xl font-bold tracking-tighter text-white tabular-nums">
          {String(count).padStart(3, '0')}
        </p>
        <p className="font-mono text-xs tracking-widest text-white/40 uppercase mt-2">
          EXTRACTION PROFILE: 93.5°C · 9.2 BAR
        </p>
      </div>

      {/* Bottom Row: Logo on left, SVG Cup on right */}
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <p className="font-mono text-xl md:text-2xl font-bold tracking-widest uppercase text-white">
            VELDT<span className="text-[#D58C3D]">.</span>
          </p>
          <p className="font-mono text-[10px] tracking-wider text-white/40 uppercase mt-1">
            SAN FRANCISCO, CA
          </p>
        </div>

        {/* SVG Cup Draw & Fill */}
        <div className="relative w-28 h-36 md:w-36 md:h-48 flex items-center justify-center">
          {/* Animated Steam */}
          <svg
            viewBox="0 0 60 40"
            className="absolute -top-8 w-16 h-10 opacity-70"
            fill="none"
          >
            <path
              d="M18 35 C 14 25, 24 15, 18 5"
              stroke="#D58C3D"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="animate-pulse"
              style={{ animationDuration: '1.8s' }}
            />
            <path
              d="M30 38 C 24 28, 36 18, 30 8"
              stroke="#E8DDD0"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="animate-pulse"
              style={{ animationDuration: '2.2s', animationDelay: '0.4s' }}
            />
            <path
              d="M42 35 C 38 25, 48 15, 42 5"
              stroke="#B07A45"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="animate-pulse"
              style={{ animationDuration: '1.6s', animationDelay: '0.8s' }}
            />
          </svg>

          {/* Cup Vector */}
          <svg
            viewBox="0 0 120 160"
            className="w-full h-full"
            fill="none"
          >
            <defs>
              <clipPath id="intro-cup-clip">
                <path d="M 22 28 L 98 28 L 86 148 Q 86 156 78 156 L 42 156 Q 34 156 34 148 Z" />
              </clipPath>
              <linearGradient id="coffee-crema-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D58C3D" />
                <stop offset="25%" stopColor="#B07A45" />
                <stop offset="100%" stopColor="#2A1A0F" />
              </linearGradient>
            </defs>

            {/* Rising Coffee Liquid inside clipped cup geometry */}
            <g clipPath="url(#intro-cup-clip)">
              <rect
                x="0"
                width="120"
                height="160"
                fill="url(#coffee-crema-gradient)"
                style={{
                  transform: `translateY(${156 - (count / 100) * 128}px)`,
                  transition: 'transform 0.05s linear',
                }}
              />
              {/* Crema surface line */}
              <line
                x1="20"
                y1={156 - (count / 100) * 128}
                x2="100"
                y2={156 - (count / 100) * 128}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeOpacity="0.4"
              />
            </g>

            {/* Cup Outline Stroke */}
            <path
              d="M 22 28 L 98 28 L 86 148 Q 86 156 78 156 L 42 156 Q 34 156 34 148 Z"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Cup Rim Top */}
            <path
              d="M 16 28 H 104"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
