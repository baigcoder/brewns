/* The order Sarah just placed, live in the call panel: each step as the café
   reaches it, the total and the time it's due, then the rider (photo, name,
   bike) and the rider on the map. It follows the café's real status by asking
   /api/orders/<number> every few seconds, the same as the tracker. */

import { DELIVERY, LOC_TITLES, money } from '@/lib/catalog';
import { riderProgress } from './orderLive';

type ServerOrder = {
  number: number;
  mode: 'delivery' | 'pickup' | 'dinein';
  stage: string;
  status: string;
  times: Record<string, number>;
  target: number;
  loc: number;
  area: number | null;
  address: string;
  totals: { total: number };
  rider: { name: string; plate: string; photo?: string; bio?: string } | null;
  riderAt?: { lat: number; lng: number; heading: number | null; t: number } | null;
  pin?: { lat: number; lng: number } | null;
  handover?: string | null;
  cancelled: { t: number; reason: string } | null;
  hold?: { until: number; ref: string } | null;
};

const STEPS = {
  delivery: [
    ['received', 'Order placed'],
    ['accepted', 'Accepted by the café'],
    ['preparing', 'Being made'],
    ['rider', 'Rider assigned'],
    ['onway', 'On the way'],
    ['arriving', 'Arriving'],
    ['delivered', 'Delivered'],
  ],
  pickup: [
    ['received', 'Order placed'],
    ['accepted', 'Accepted by the café'],
    ['preparing', 'Being made'],
    ['ready', 'Ready to collect'],
    ['collected', 'Collected'],
  ],
} as const;

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
const face = (name: string, photo?: string) =>
  photo && /^(\/api\/public\/staff-photo\/|https:\/\/res\.cloudinary\.com\/)/.test(photo)
    ? `<img class="vco-face" src="${esc(photo)}" alt="" width="40" height="40">`
    : `<span class="vco-face">${esc(name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</span>`;

/** Shows (or replaces) the live order card in the call panel. Returns a function that stops it. */
export function showVoiceOrder(card: HTMLElement, first: ServerOrder, key: string, openTracking: (n: number) => void) {
  card.querySelector('.vco')?.dispatchEvent(new Event('vco-stop'));
  card.querySelector('.vco')?.remove();
  const el = document.createElement('section');
  el.className = 'vco';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Your order');
  card.querySelector('.vcall-stage')?.after(el);

  let o = first;
  let map: { update: (s: object) => number; destroy: () => void } | null = null;
  let mapBusy = false;
  let checked = Date.now();
  let stopped = false;

  const steps = o.mode === 'delivery' ? STEPS.delivery : STEPS.pickup;
  const final = o.mode === 'delivery' ? 'delivered' : 'collected';

  function draw() {
    const at = Math.max(0, steps.findIndex(([k]) => k === o.stage));
    const done = o.stage === final;
    const left = Math.max(0, Math.ceil((o.target - Date.now()) / 60000));
    const where = o.mode === 'delivery' ? `${o.address}${o.area !== null ? `, ${DELIVERY.areas[o.area][0]}` : ''}` : LOC_TITLES[o.loc];
    const head = o.cancelled ? 'Cancelled' : o.hold ? 'Waiting for your payment' : done ? (o.mode === 'delivery' ? 'Delivered' : 'Collected') : steps[at][1];
    el.innerHTML = `
      <div class="vco-head">
        <div><p class="vco-k">ORDER #${String(o.number).padStart(5, '0')} · ${money(o.totals.total)}</p><p class="vco-h">${esc(head)}</p></div>
        <div class="vco-eta">${o.cancelled || done ? '' : `<b>${left ? `${left} min` : 'Now'}</b><span>${o.mode === 'delivery' ? 'at your door' : 'ready'} ${hhmm(o.target)}</span>`}</div>
      </div>
      ${o.hold ? `<a class="vco-open" href="/pay/${o.number}?k=${encodeURIComponent(key)}">Pay now to start the order</a>` : ''}
      <p class="vco-where">${o.mode === 'delivery' ? 'TO ' : 'COLLECT AT '}${esc(where.toUpperCase())}</p>
      ${o.mode === 'delivery' && at >= 3 && !o.cancelled ? `<div class="vco-map" data-map></div>` : ''}
      <ol class="vco-steps">${steps
        .map(([k, label], i) => `<li class="${i < at || done ? 'on' : i === at ? 'now' : ''}"><i></i><span>${label}</span>${o.times[k] ? `<time>${hhmm(o.times[k])}</time>` : ''}</li>`)
        .join('')}</ol>
      ${
        o.rider && o.mode === 'delivery'
          ? `<div class="vco-rider">${face(o.rider.name, o.rider.photo)}<div><p><b>${esc(o.rider.name)}</b>${o.rider.plate ? ` · ${esc(o.rider.plate)}` : ''}</p><p class="vco-k">YOUR RIDER${o.rider.bio ? ` · “${esc(o.rider.bio)}”` : ''}</p></div></div>`
          : ''
      }
      ${o.handover && o.mode === 'delivery' && !done && !o.cancelled ? `<p class="vco-code"><span>GIVE THE RIDER THIS CODE</span><b>${esc(o.handover)}</b></p>` : ''}
      <p class="vco-live"><i></i>${Date.now() - checked > 20000 ? 'Reconnecting…' : 'Live from the café'}</p>
      <button type="button" class="vco-open">Open full tracking</button>`;
    el.querySelector<HTMLButtonElement>('.vco-open')!.onclick = () => openTracking(o.number);
    const mapEl = el.querySelector<HTMLElement>('[data-map]');
    if (mapEl) placeMap(mapEl);
  }

  // The map lives across redraws: its element is moved into each new card body.
  let mapHost: HTMLElement | null = null;
  function placeMap(slot: HTMLElement) {
    if (mapHost) {
      slot.replaceWith(mapHost);
      updateMap();
      return;
    }
    if (mapBusy || o.area === null) return;
    mapBusy = true;
    mapHost = slot;
    Promise.all([import('./riderMap'), import('./deliveryRoutes')]).then(([{ createRiderMap }, { ROUTES }]) => {
      if (stopped || !mapHost) return;
      map = createRiderMap(mapHost, {
        route: ROUTES[o.area!],
        door: o.pin ? [o.pin.lat, o.pin.lng] : null,
        areaName: DELIVERY.areas[o.area!][0],
        shopName: `BREWNS · ${LOC_TITLES[o.loc]}`,
        riderName: (o.rider?.name.split(' ')[0] || 'RIDER').toUpperCase(),
      }) as never;
      updateMap();
    });
  }
  function updateMap() {
    if (!map) return;
    const riding = o.stage === 'onway' || o.stage === 'arriving';
    const progress = riderProgress({ mode: 'delivery', target: o.target, server: { stage: o.stage, times: o.times } } as never, [], Date.now());
    const fix = riding && o.riderAt ? o.riderAt : null;
    map.update({ show: true, riding, progress: o.stage === 'delivered' ? 1 : progress, fix, stale: !!fix && Date.now() - fix.t > 120000 });
  }

  async function poll() {
    if (stopped || !el.isConnected) return stop();
    try {
      const res = await fetch(`/api/orders/${o.number}?k=${encodeURIComponent(key)}`, { cache: 'no-store' });
      if (res.ok) {
        o = (await res.json()).order;
        checked = Date.now();
      }
    } catch {}
    draw();
    if (o.stage === final || o.cancelled) stop(false);
  }
  const timer = window.setInterval(poll, 5000);
  const tick = window.setInterval(() => !stopped && updateMap(), 1000);
  function stop(remove = true) {
    stopped = remove || stopped;
    clearInterval(timer);
    clearInterval(tick);
    if (remove) {
      map?.destroy();
      map = null;
    }
  }
  el.addEventListener('vco-stop', () => stop());
  draw();
  return () => stop();
}
