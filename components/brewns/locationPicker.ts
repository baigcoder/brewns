/* "Where exactly?" — a map of Lahore you drag until the pin sits on your door,
   like a ride-hailing app. The pin stays in the middle; the map moves under it.
   It says which delivery area the spot is in, and won't confirm a spot outside
   them. The rider then gets this exact point. */

import { DELIVERY } from '@/lib/catalog';
import { ROUTES } from './deliveryRoutes';
import { metres, TILE, world, type LatLng } from './riderMap';

const MAX_KM = 6;
const unworld = (x: number, y: number, z: number): LatLng => {
  const s = 256 * 2 ** z;
  const lng = (x / s) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / s))) * 180) / Math.PI;
  return [lat, lng];
};

/** The delivery area a point is in (nearest area, if within reach), or null. */
export function areaFor(p: LatLng) {
  const d = ROUTES.map((r) => metres(r[r.length - 1], p));
  const i = d.indexOf(Math.min(...d));
  return d[i] <= MAX_KM * 1000 ? i : null;
}

export function openLocationPicker(opts: { start: LatLng; onPick: (p: { lat: number; lng: number }, area: number) => void }) {
  const prevFocus = document.activeElement as HTMLElement | null;
  const root = document.createElement('div');
  root.className = 'lp';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Pick your delivery location');
  root.innerHTML = `
    <div class="lp-card">
      <header class="lp-top"><p class="mono-fine">MOVE THE MAP TO PUT THE PIN ON YOUR DOOR</p><button type="button" class="lp-x" aria-label="Close">✕</button></header>
      <div class="lp-map" tabindex="0" aria-label="Map. Drag, or use the arrow keys, to move it.">
        <div class="lp-tiles"></div>
        <span class="lp-pin" aria-hidden="true"><svg viewBox="0 0 24 36" width="34" height="50"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 36 12 36s12-15.2 12-24.1C24 5.3 18.6 0 12 0z" fill="#d58c3d" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg></span>
        <span class="lp-shadow" aria-hidden="true"></span>
        <div class="lp-zoom"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">−</button></div>
        <span class="lp-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></span>
      </div>
      <footer class="lp-bottom">
        <p class="lp-area mono-fine" aria-live="polite"></p>
        <div class="lp-btns"><button type="button" class="btn btn-line lp-me">⌖ MY LOCATION</button><button type="button" class="btn btn-solid lp-ok">DELIVER HERE</button></div>
      </footer>
    </div>`;
  document.body.append(root);
  const mapEl = root.querySelector<HTMLElement>('.lp-map')!;
  const tiles = root.querySelector<HTMLElement>('.lp-tiles')!;
  const areaEl = root.querySelector<HTMLElement>('.lp-area')!;
  const ok = root.querySelector<HTMLButtonElement>('.lp-ok')!;

  let center: LatLng = opts.start;
  let z = 16;
  let frame = 0;
  const draw = () => {
    frame = 0;
    const W = mapEl.clientWidth, H = mapEl.clientHeight;
    const [cx, cy] = world(center, z);
    const ox = cx - W / 2, oy = cy - H / 2, n = 2 ** z;
    const frag = document.createDocumentFragment();
    for (let tx = Math.floor(ox / 256); tx * 256 < ox + W; tx++)
      for (let ty = Math.floor(oy / 256); ty * 256 < oy + H; ty++) {
        if (ty < 0 || ty >= n) continue;
        const img = new Image(256, 256);
        img.alt = '';
        img.src = TILE(z, ((tx % n) + n) % n, ty);
        img.style.transform = `translate(${Math.round(tx * 256 - ox)}px,${Math.round(ty * 256 - oy)}px)`;
        frag.append(img);
      }
    tiles.replaceChildren(frag);
    const area = areaFor(center);
    areaEl.textContent = area === null ? 'OUTSIDE OUR DELIVERY AREAS · MOVE THE PIN CLOSER' : `DELIVERY AREA: ${DELIVERY.areas[area][0]} · RS ${DELIVERY.areas[area][2]} · ~${DELIVERY.areas[area][3]} MIN`;
    areaEl.classList.toggle('bad', area === null);
    ok.disabled = area === null;
  };
  const redraw = () => (frame ||= requestAnimationFrame(draw));
  const moveBy = (dx: number, dy: number) => {
    const [cx, cy] = world(center, z);
    center = unworld(cx - dx, cy - dy, z);
    redraw();
  };

  // drag (mouse, finger or pen)
  let drag: { x: number; y: number } | null = null;
  mapEl.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    drag = { x: e.clientX, y: e.clientY };
    mapEl.setPointerCapture(e.pointerId);
    root.classList.add('dragging');
  });
  mapEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    moveBy(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => {
    drag = null;
    root.classList.remove('dragging');
  };
  mapEl.addEventListener('pointerup', end);
  mapEl.addEventListener('pointercancel', end);
  const zoom = (by: number) => {
    z = Math.max(12, Math.min(18, z + by));
    redraw();
  };
  mapEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  root.querySelectorAll<HTMLButtonElement>('[data-z]').forEach((b) => (b.onclick = () => zoom(Number(b.dataset.z))));
  mapEl.addEventListener('keydown', (e) => {
    const step = 60;
    const k: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (k[e.key]) {
      e.preventDefault();
      moveBy(...k[e.key]);
    } else if (e.key === '+' || e.key === '=') zoom(1);
    else if (e.key === '-') zoom(-1);
  });

  root.querySelector<HTMLButtonElement>('.lp-me')!.onclick = () => {
    if (!navigator.geolocation) return (areaEl.textContent = "THIS BROWSER CAN'T SHARE A LOCATION · DRAG THE MAP INSTEAD");
    areaEl.textContent = 'FINDING YOU…';
    navigator.geolocation.getCurrentPosition(
      (p) => {
        center = [p.coords.latitude, p.coords.longitude];
        z = 17;
        redraw();
      },
      () => {
        areaEl.textContent = 'LOCATION NOT SHARED · DRAG THE MAP TO YOUR DOOR';
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const close = () => {
    ro.disconnect();
    root.remove();
    document.removeEventListener('keydown', onEsc);
    prevFocus?.focus?.({ preventScroll: true });
  };
  const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onEsc);
  root.querySelector<HTMLButtonElement>('.lp-x')!.onclick = close;
  root.addEventListener('click', (e) => e.target === root && close());
  ok.onclick = () => {
    const area = areaFor(center);
    if (area === null) return;
    opts.onPick({ lat: +center[0].toFixed(5), lng: +center[1].toFixed(5) }, area);
    close();
  };
  const ro = new ResizeObserver(redraw);
  ro.observe(mapEl);
  mapEl.focus({ preventScroll: true });
  draw();
}
