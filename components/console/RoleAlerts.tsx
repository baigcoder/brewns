'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { playKitchenChime, playWaiterBell } from '@/lib/audio-alerts';
import { orderAlerts, snapshot, type AlertKind, type Snapshot } from '@/lib/orderAlerts';
import { useNow } from './api';
import { chime, useLive } from './Live';
import { rideAlert } from './RiderAlerts';
import { useMe } from './Shell';
import { useToast } from './Toasts';

/** The screen that already rings for a moment: there it stays quiet, so nothing rings twice. */
const RINGS_ON: Partial<Record<AlertKind, string>> = { accept: '/dashboard/orders', 'needs-rider': '/dashboard/deliveries', ticket: '/dashboard/kitchen', call: '/dashboard/floor' };
const SOUND: Partial<Record<AlertKind, () => void>> = { accept: chime, 'needs-rider': rideAlert, late: chime, message: chime, ticket: playKitchenChime, stop: chime, serve: playWaiterBell, call: playWaiterBell };

/** On every console screen: a chime and a toast for each moment this person's role has to act on (lib/orderAlerts.ts). */
export function RoleAlerts() {
  const { data } = useLive();
  const { perms } = useMe();
  const toast = useToast();
  const path = usePathname();
  // Lateness grows with the clock, not the poll, so look again every half minute too.
  const now = useNow(30000);
  const seen = useRef<Snapshot | null>(null);

  useEffect(() => {
    if (!data) return;
    const next = snapshot(data.orders, data.calls, perms, Date.now());
    const alerts = orderAlerts(seen.current, next, data.orders, data.calls, perms);
    seen.current = next;
    const rang = new Set<AlertKind>();
    for (const a of alerts) {
      const here = RINGS_ON[a.kind] === path;
      if (!here) toast(a.text, a.tone);
      if (!here && !rang.has(a.kind)) SOUND[a.kind]?.();
      rang.add(a.kind);
    }
  }, [data, now, perms, path, toast]);

  return null;
}
