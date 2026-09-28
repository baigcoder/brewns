'use client';

import { useEffect } from 'react';

/**
 * On localhost only: report missing section styles or a failed engine to help
 * diagnose screenshots. Never appears on the live site.
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
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;padding:12px 14px;background:#fff3cd;color:#3d2c00;border:2px solid #d8b777;font:12px/1.5 monospace;white-space:pre-wrap;';
  box.textContent = [
    'brewns dev check: screenshot this and send it to Codex',
    `server commit: ${build || 'unknown'}`,
    initError ? `engine failed to start: ${String((initError as Error)?.stack || initError).slice(0, 300)}` : 'engine: started',
    `later-section styles: ${styled ? 'applied' : 'MISSING'}`,
    `browser: ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 120)}`,
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

export function BrewnsEngineLoader({ kitchenPhotos, cafeRecording, build }: { kitchenPhotos?: Record<string, string>; cafeRecording?: boolean; build?: string }) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let initError: unknown = null;
    let mounted = true;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTask: number | undefined;

    // Paint the real page before downloading and parsing the interactive engine.
    const loadEngine = () => {
      if (!mounted) return;
      import('./initBrewns')
        .then(({ initBrewns }) => {
          if (!mounted) return;
          try {
            cleanup = initBrewns(document.body, { kitchenPhotos, cafeRecording });
          } catch (err) {
            initError = err;
            console.error('Failed to init Brewns engine:', err);
          }
        })
        .catch((err) => {
          initError = err;
          console.error('Failed to load Brewns engine chunk:', err);
        });
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      idleTask = idleWindow.requestIdleCallback(loadEngine, { timeout: 1400 });
    } else {
      loadTimer = setTimeout(loadEngine, 300);
    }
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const check = local ? setTimeout(() => devHealthCheck(initError, build), 4000) : 0;
    if (local) console.info(`brewns: server commit ${build || 'unknown'}`);

    return () => {
      mounted = false;
      if (loadTimer) clearTimeout(loadTimer);
      if (idleTask !== undefined) idleWindow.cancelIdleCallback?.(idleTask);
      clearTimeout(check);
      try {
        cleanup?.();
      } catch (err) {
        console.error('Error during cleanup:', err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once at mount
  }, []);

  return null;
}
