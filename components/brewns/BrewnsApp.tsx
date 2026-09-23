'use client';

import React, { useEffect, useRef } from 'react';
import { BREWNS_MARKUP } from './brewnsMarkup';
import { initBrewns } from './initBrewns';

export function BrewnsApp() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanup: (() => void) | undefined;
    // Slight delay to ensure DOM is fully mounted and fonts ready
    const timer = setTimeout(() => {
      try {
        cleanup = initBrewns();
      } catch (err) {
        console.error('Failed to init Brewns engine:', err);
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      try {
        cleanup?.();
      } catch (e) {
        console.error('Error during cleanup:', e);
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      id="brewns-root"
      dangerouslySetInnerHTML={{ __html: BREWNS_MARKUP }}
    />
  );
}
