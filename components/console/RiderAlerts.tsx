'use client';

import { useEffect, useRef } from 'react';
import { DELIVERY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { chime, useLive } from './Live';
import { useMe } from './Shell';
import { useToast } from './Toasts';

/** A ride alert: the chime three times and a buzz, loud enough to hear from a pocket. */
export function rideAlert() {
  chime();
  window.setTimeout(chime, 700);
  window.setTimeout(chime, 1400);
  try {
    navigator.vibrate?.([250, 120, 250, 120, 400]);
  } catch {}
}

/** A system notification, so it shows on the lock screen or another tab. Through the service worker where it has to be (Android). */
async function notify(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: '/icon.svg', data: { url: '/dashboard/deliveries' } } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, opts));
    new Notification(title, opts);
  } catch {}
}

/** Asks once for notification permission (needs a tap). Returns whether they're on. */
export async function enableNotifications() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'default') await Notification.requestPermission().catch(() => 'denied');
  return Notification.permission === 'granted';
}

/**
 * For riders, on every console screen: a ride alert the moment a delivery is given to them,
 * and again when it's ready at the pass to pick up.
 */
export function RiderAlerts() {
  const { data } = useLive();
  const { me, can } = useMe();
  const toast = useToast();
  const seen = useRef<Map<number, string> | null>(null);

  useEffect(() => {
    if (!data || !can('delivery.ride')) return;
    const mine = data.orders.filter((o) => o.mode === 'delivery' && o.rider?.id === me.id && o.status !== 'cancelled' && o.status !== 'delivered');
    const now = new Map(mine.map((o) => [o.number, o.status]));
    const before = seen.current;
    seen.current = now;
    if (!before) return; // the first look is not news
    for (const o of mine) {
      const area = o.area !== null ? DELIVERY.areas[o.area][0] : '';
      if (!before.has(o.number)) {
        rideAlert();
        toast(`New delivery for you · ${orderNo(o.number)}${area ? ` · ${area}` : ''}`, 'good');
        void notify(`New delivery ${orderNo(o.number)}`, `${area ? `${area} · ` : ''}${o.status === 'ready' ? 'Ready at the pass now.' : 'Being made. We will buzz you when it is ready.'}`, `ride-${o.number}`);
      } else if (o.status === 'ready' && before.get(o.number) !== 'ready') {
        rideAlert();
        toast(`${orderNo(o.number)} is ready at the pass. Start the ride.`, 'good');
        void notify(`${orderNo(o.number)} is ready`, 'Pick it up at the pass and start the ride.', `ride-${o.number}`);
      }
    }
  }, [data, me.id, can, toast]);

  return null;
}
