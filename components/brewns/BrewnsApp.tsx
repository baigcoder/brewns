'use client';

import React, { useEffect, useRef } from 'react';
import { BREWNS_MARKUP } from './brewnsMarkup';
import { initBrewns } from './initBrewns';

export function BrewnsApp({ kitchenPhotos, cafeRecording }: { kitchenPhotos?: Record<string, string>; cafeRecording?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanup: (() => void) | undefined;
    // Slight delay to ensure DOM is fully mounted and fonts ready
    const timer = setTimeout(() => {
      try {
        cleanup = initBrewns(document.body, { kitchenPhotos, cafeRecording });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once at mount
  }, []);

  return (
    <div
      ref={rootRef}
      id="brewns-root"
      dangerouslySetInnerHTML={{ __html: BREWNS_MARKUP }}
    />
  );
}
