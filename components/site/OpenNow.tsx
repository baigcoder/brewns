'use client';

import { useEffect, useState } from 'react';
import { cafeHoursStatusLabel, getCafeOpeningStatus } from '@/lib/openingHours';

/** "Open now · closes 21:00", worked out in the visitor's browser so a cached page never lies. */
export function OpenNow() {
  const [state, setState] = useState<{ open: boolean; label: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const s = getCafeOpeningStatus();
      setState({ open: s.isOpen, label: cafeHoursStatusLabel(s) });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className={`ip-chip ${state ? (state.open ? 'open' : 'closed') : ''}`} role="status">
      <i aria-hidden="true" />
      {state ? state.label : 'Open daily 07:00–21:00'}
    </span>
  );
}
