'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const SEEN = 'brewns-visits';
const NO = 'brewns-install-no';

/**
 * "Add brewns to your home screen", offered to a regular on their second visit, where the browser can install the
 * site (Chrome, Edge, Samsung Internet; Safari cannot be asked). Never on the staff screens, never again once dismissed.
 */
export function InstallPrompt() {
  const path = usePathname();
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let visits = 0;
    try {
      if (localStorage.getItem(NO)) return;
      // One visit per browser session.
      if (!sessionStorage.getItem(SEEN)) {
        localStorage.setItem(SEEN, String((Number(localStorage.getItem(SEEN)) || 0) + 1));
        sessionStorage.setItem(SEEN, '1');
      }
      visits = Number(localStorage.getItem(SEEN)) || 0;
    } catch {
      return;
    }
    if (visits < 2) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!event || /^\/(dashboard|staff|owner)/.test(path)) return null;

  const close = (forever: boolean) => {
    if (forever) {
      try {
        localStorage.setItem(NO, '1');
      } catch {}
    }
    setEvent(null);
  };

  return (
    <div className="install-card" role="dialog" aria-label="Install brewns">
      <p>
        <b>Add brewns to your home screen</b>
        Order in two taps and see when your cup is ready.
      </p>
      <div>
        <button
          type="button"
          className="install-yes"
          onClick={async () => {
            await event.prompt();
            const { outcome } = await event.userChoice;
            close(outcome === 'accepted');
          }}
        >
          Install
        </button>
        <button type="button" className="install-no" onClick={() => close(true)}>
          No thanks
        </button>
      </div>
    </div>
  );
}
