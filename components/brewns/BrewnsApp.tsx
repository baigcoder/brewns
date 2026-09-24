'use client';

import React, { useEffect, useRef } from 'react';
import { BREWNS_MARKUP } from './brewnsMarkup';
import { initBrewns } from './initBrewns';

/**
 * On a local server only (localhost): if the later sections' styles are
 * missing, or the engine failed to start, say so on the page with what the
 * browser actually loaded and which commit the server runs, so a screenshot
 * shows the cause. Never shows on the real site.
 */
function devHealthCheck(initError: unknown, build = '') {
  const grid = document.querySelector('.inside-grid');
  const styled = !grid || getComputedStyle(grid).display === 'grid';
  if (styled && !initError) return;
  const sheets = [...document.styleSheets].map((sheet) => {
    let rules: number | string = '?';
    let inside = false;
    try {
      rules = sheet.cssRules.length;
      inside = [...sheet.cssRules].some((r) => r.cssText.includes('.inside-grid'));
    } catch {
      rules = 'blocked';
    }
    return `${(sheet.href || 'inline').split('/').pop()} · ${rules} rules${inside ? ' · has .inside-grid' : ''}`;
  });
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;padding:12px 14px;background:#fff3cd;color:#3d2c00;border:2px solid #d8b777;font:12px/1.5 monospace;white-space:pre-wrap;';
  box.textContent = [
    'brewns dev check: screenshot this and send it to Claude',
    `server commit: ${build || 'unknown'}`,
    initError ? `engine failed to start: ${String((initError as Error)?.stack || initError).slice(0, 300)}` : 'engine: started',
    `later-section styles: ${styled ? 'applied' : 'MISSING'}`,
    `browser: ${navigator.userAgent.replace(/^Mozilla\/5.0 /, '').slice(0, 120)}`,
    'stylesheets:',
    ...sheets.map((s) => `  ${s}`),
  ].join('\n');
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close');
  close.style.cssText = 'position:absolute;top:4px;right:8px;font:18px monospace;background:none;border:0;cursor:pointer;';
  close.onclick = () => box.remove();
  box.append(close);
  document.body.append(box);
}

export function BrewnsApp({ kitchenPhotos, cafeRecording, build }: { kitchenPhotos?: Record<string, string>; cafeRecording?: boolean; build?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanup: (() => void) | undefined;
    let initError: unknown = null;
    // Slight delay to ensure DOM is fully mounted and fonts ready
    const timer = setTimeout(() => {
      try {
        cleanup = initBrewns(document.body, { kitchenPhotos, cafeRecording });
      } catch (err) {
        initError = err;
        console.error('Failed to init Brewns engine:', err);
      }
    }, 50);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const check = local ? setTimeout(() => devHealthCheck(initError, build), 4000) : 0;
    if (local) console.info(`brewns: server commit ${build || 'unknown'}`);

    return () => {
      clearTimeout(timer);
      clearTimeout(check);
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
