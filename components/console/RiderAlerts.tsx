'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DELIVERY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { rtcCall, type CallPhase, type CallView } from '@/lib/rtcCall';
import { api } from './api';
import { chime, useLive } from './Live';
import { useMe } from './Shell';
import { unread } from './OrderBits';
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
  const heard = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!data || !can('delivery.ride')) return;
    const mine = data.orders.filter((o) => o.mode === 'delivery' && o.rider?.id === me.id && o.status !== 'cancelled' && o.status !== 'delivered');
    const now = new Map(mine.map((o) => [o.number, o.status]));
    const before = seen.current;
    seen.current = now;
    const wrote = heard.current;
    heard.current = new Map(mine.map((o) => [o.number, unread(o)]));
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
    // The customer wrote to their rider.
    for (const o of mine) {
      if (unread(o) <= (wrote.get(o.number) || 0)) continue;
      const last = o.messages.findLast((m) => m.from === 'you')?.text || 'a new message';
      chime();
      toast(`${o.name.split(' ')[0]} on ${orderNo(o.number)}: ${last}`, 'good');
      void notify(`Message on ${orderNo(o.number)}`, last, `msg-${o.number}`);
    }
  }, [data, me.id, can, toast]);

  return null;
}

/** On every console screen: a chime and a toast when someone sends this person a private message. */
export function MessageAlerts() {
  const { data } = useLive();
  const toast = useToast();
  const path = usePathname();
  const seen = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    if (!data?.dms) return;
    const before = seen.current;
    seen.current = new Map(data.dms.map((t) => [t.with, t.unread]));
    if (!before) return; // the first look is not news
    const news = data.dms.filter((t) => t.unread > (before.get(t.with) || 0));
    if (!news.length) return;
    chime();
    // The messages screen shows them itself.
    if (path !== '/dashboard/messages') for (const t of news) toast(`${t.name}: ${t.last}`, 'good');
  }, [data, path, toast]);

  return null;
}

/**
 * Riders, on every console screen: an in-app voice call with the customer of a delivery that is theirs.
 * Rings when the customer calls; the order drawer's Call button starts one (the `brewns:call` event).
 */
export function RiderCall() {
  const { data } = useLive();
  const { can } = useMe();
  const toast = useToast();
  const [call, setCall] = useState<{ number: number; phase: CallPhase } | null>(null);
  const hangup = useRef<(() => void) | null>(null);
  const ride = can('delivery.ride');
  const ringing = ride && !call ? data?.rtc?.find((c) => c.from === 'you' && c.state === 'ringing') : undefined;
  const who = (n: number) => data?.orders.find((o) => o.number === n)?.name.split(' ')[0] || 'The customer';

  const begin = useCallback(
    (number: number, offer?: string) => {
      const url = `/api/staff/orders/${number}/call`;
      setCall({ number, phase: offer ? 'connecting' : 'ringing' });
      hangup.current = rtcCall({
        offer,
        get: () => api<{ call: CallView | null }>(url).then((r) => r.call),
        post: (b) => api(url, b),
        onPhase: (phase, why) => {
          if (phase !== 'ended') return setCall({ number, phase });
          hangup.current = null;
          setCall(null);
          if (why) toast(why);
        },
      });
    },
    [toast],
  );

  useEffect(() => {
    const go = (e: Event) => !hangup.current && begin((e as CustomEvent<number>).detail);
    window.addEventListener('brewns:call', go);
    return () => window.removeEventListener('brewns:call', go);
  }, [begin]);

  // Ring until they answer, or the customer gives up.
  useEffect(() => {
    if (!ringing) return;
    rideAlert();
    const t = window.setInterval(rideAlert, 3500);
    return () => clearInterval(t);
  }, [ringing?.number]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (number: number) => {
    const r = await api<{ call: CallView | null }>(`/api/staff/orders/${number}/call`).catch(() => null);
    if (r?.call?.state !== 'ringing') return toast('That call has ended.');
    begin(number, r.call.offer);
  };

  if (!ringing && !call) return null;
  const n = call?.number ?? ringing!.number;
  return (
    <div className="cx-card cx-row between" role="alertdialog" aria-label="Call" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 80, maxWidth: 480, margin: '0 auto', boxShadow: '0 12px 30px rgb(0 0 0 / 0.45)' }}>
      <div>
        <p style={{ fontWeight: 600 }}>
          {who(n)} · {orderNo(n)}
        </p>
        <p className="cx-small cx-muted">{!call ? 'Calling you…' : call.phase === 'live' ? 'On the call' : call.phase === 'ringing' ? 'Ringing…' : 'Connecting…'}</p>
      </div>
      <div className="cx-row">
        {!call && (
          <button type="button" className="cx-btn primary" onClick={() => answer(n)}>
            Answer
          </button>
        )}
        <button type="button" className="cx-btn danger" onClick={() => (call ? hangup.current?.() : api(`/api/staff/orders/${n}/call`, { op: 'end' }).catch(() => {}))}>
          {call ? 'Hang up' : 'Decline'}
        </button>
      </div>
    </div>
  );
}
