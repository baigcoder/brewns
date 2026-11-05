/**
 * The live delivery map: real Lahore streets (OpenStreetMap tiles), the shop,
 * the customer's door, the road between them, and the rider's bike pointing
 * the way it is going. The view fits the whole trip so the shop, the door, the
 * rider and the road ahead are always on screen, on a phone too.
 *
 * The rider sits at their phone's last GPS fix when there is one, and
 * otherwise at an estimate along the road (`progress`, 0 at the shop, 1 at
 * the door). The marker glides between updates instead of jumping.
 *
 * No map library: a fixed view needs only a grid of tiles and an SVG overlay.
 */

export type LatLng = [number, number];
export type Fix = { lat: number; lng: number; heading: number | null; t: number };
export type MapState = { show: boolean; riding: boolean; progress: number; fix: Fix | null; stale: boolean };

// shortcut: OpenStreetMap's own tile server suits a small café's traffic; at real volume, point this at a paid tile host (MapTiler, Stadia).
export const TILE = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const R = 6371000;
const rad = Math.PI / 180;

/** Metres between two points. */
export const metres = (a: LatLng, b: LatLng) => {
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
/** Compass bearing from a to b, degrees clockwise from north. */
export const bearing = (a: LatLng, b: LatLng) => {
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
  const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
};
/** Web-Mercator pixels at zoom z. */
export const world = ([lat, lng]: LatLng, z: number) => {
  const s = 256 * 2 ** z, sin = Math.sin(lat * rad);
  return [((lng + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
};

/** The road to the door: the area's route, cut where it passes nearest an exact door and finished there. */
export function tripPath(route: LatLng[], door: LatLng | null): LatLng[] {
  if (!door) return route;
  let best = 0;
  route.forEach((p, i) => metres(p, door) < metres(route[best], door) && (best = i));
  return [...route.slice(0, best + 1), door];
}

/** Cumulative metres along a path. */
const along = (path: LatLng[]) => path.reduce<number[]>((c, p, i) => (c.push(i ? c[i - 1] + metres(path[i - 1], p) : 0), c), []);

/** The point `d` metres along a path, and which way the road runs there. */
export function pointAlong(path: LatLng[], cum: number[], d: number): { p: LatLng; heading: number } {
  const total = cum[cum.length - 1];
  d = Math.max(0, Math.min(total, d));
  let i = 1;
  while (i < path.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1, t = (d - cum[i - 1]) / seg;
  const [a, b] = [path[i - 1], path[i]];
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: bearing(a, b) };
}

/** Where a point falls along a path: metres from the start, and how far it is off the road. */
export function snap(path: LatLng[], cum: number[], q: LatLng) {
  let best = { d: 0, off: Infinity };
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    // flat projection is fine across one street segment
    const kx = Math.cos(a[0] * rad);
    const ax = (b[1] - a[1]) * kx, ay = b[0] - a[0], qx = (q[1] - a[1]) * kx, qy = q[0] - a[0];
    const t = Math.max(0, Math.min(1, (qx * ax + qy * ay) / (ax * ax + ay * ay || 1)));
    const p: LatLng = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const off = metres(p, q);
    if (off < best.off) best = { d: cum[i - 1] + (cum[i] - cum[i - 1]) * t, off };
  }
  return best;
}

const svgNS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(svgNS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
};
const div = (cls: string, html = '') => Object.assign(document.createElement('div'), { className: cls, innerHTML: html });

export function createRiderMap(mount: HTMLElement, opts: { route: LatLng[]; door: LatLng | null; areaName: string; shopName: string; riderName: string }) {
  const shop = opts.route[0];
  let path: LatLng[], cum: number[], total: number, door: LatLng, exact: boolean;
  const tiles = div('rm-tiles');
  const svg = el('svg', { class: 'rm-svg', 'aria-hidden': 'true' });
  const behind = el('polyline', { class: 'rm-behind' });
  const casing = el('polyline', { class: 'rm-casing' });
  const ahead = el('polyline', { class: 'rm-ahead' });
  const offroad = el('line', { class: 'rm-offroad' });
  svg.append(behind, casing, ahead, offroad);
  const shopPin = div('rm-pin rm-shop', `<span class="rm-dot">b</span><span class="rm-tag mono-fine">${opts.shopName}</span>`);
  const doorPin = div('rm-pin rm-door', `<span class="rm-dot"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/></svg></span><span class="rm-tag mono-fine"></span>`);
  const rider = div('rm-pin rm-rider', `<span class="rm-pulse"></span><span class="rm-arrow"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2 20 21 12 16.5 4 21z"/></svg></span><span class="rm-tag mono-fine">${opts.riderName}</span>`);
  const credit = div('rm-credit', '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>');
  mount.prepend(tiles, svg, shopPin, doorPin, rider, credit);

  const setDoor = (d: LatLng | null) => {
    exact = !!d;
    door = d || opts.route[opts.route.length - 1];
    path = tripPath(opts.route, d);
    cum = along(path);
    total = cum[cum.length - 1];
    doorPin.querySelector('.rm-tag')!.textContent = exact ? 'YOUR DOOR' : `~ ${opts.areaName}`;
    doorPin.classList.toggle('approx', !exact);
    layout();
  };

  // the view: the largest zoom that fits the trip (and the rider, if a fix strays off it)
  let z = 14, ox = 0, oy = 0, W = 0, H = 0;
  const px = (p: LatLng): [number, number] => {
    const [x, y] = world(p, z);
    return [x - ox, y - oy];
  };
  const PAD = { t: 64, r: 34, b: 30, l: 34 };
  let extra: LatLng | null = null;
  function layout() {
    W = mount.clientWidth;
    H = mount.clientHeight;
    if (!W || !H || !path) return;
    const pts = [...path, ...(extra ? [extra] : [])];
    for (z = 17; z > 10; z--) {
      const xs = pts.map((p) => world(p, z));
      const [x0, x1, y0, y1] = [Math.min(...xs.map((p) => p[0])), Math.max(...xs.map((p) => p[0])), Math.min(...xs.map((p) => p[1])), Math.max(...xs.map((p) => p[1]))];
      if (x1 - x0 <= W - PAD.l - PAD.r && y1 - y0 <= H - PAD.t - PAD.b) {
        ox = (x0 + x1) / 2 - (W + PAD.l - PAD.r) / 2;
        oy = (y0 + y1) / 2 - (H + PAD.t - PAD.b) / 2;
        break;
      }
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const n = 2 ** z, frag = document.createDocumentFragment();
    for (let tx = Math.floor(ox / 256); tx * 256 < ox + W; tx++)
      for (let ty = Math.floor(oy / 256); ty * 256 < oy + H; ty++) {
        if (ty < 0 || ty >= n) continue;
        const img = new Image(256, 256);
        img.alt = '';
        img.decoding = 'async';
        img.src = TILE(z, ((tx % n) + n) % n, ty);
        img.style.transform = `translate(${Math.round(tx * 256 - ox)}px,${Math.round(ty * 256 - oy)}px)`;
        frag.append(img);
      }
    tiles.replaceChildren(frag);
    const put = (node: HTMLElement, p: LatLng) => {
      const [x, y] = px(p);
      node.style.transform = `translate(${x}px,${y}px)`;
    };
    put(shopPin, shop);
    put(doorPin, door);
    drawn = -1;
    paint();
  }

  // the rider: where it is drawn now, eased toward where it should be
  let state: MapState = { show: false, riding: false, progress: 0, fix: null, stale: false };
  let shown: LatLng | null = null, head = 0, drawn = -1, raf = 0, last = 0;
  const target = () => {
    if (state.fix) return { p: [state.fix.lat, state.fix.lng] as LatLng, heading: state.fix.heading };
    const a = pointAlong(path, cum, state.progress * total);
    return { p: a.p, heading: a.heading };
  };
  const line = (pts: LatLng[]) => pts.map((p) => px(p).map((v) => v.toFixed(1)).join(',')).join(' ');
  /** Metres still to ride, along the road when the rider is on it. */
  let left = 0;
  function paint() {
    if (!path || !W) return;
    const t = target();
    if (!shown || metres(shown, t.p) > 1500) shown = t.p;
    const now = performance.now(), dt = Math.min(0.25, (now - (last || now)) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 2.5);
    const prev = shown;
    shown = [shown[0] + (t.p[0] - shown[0]) * k, shown[1] + (t.p[1] - shown[1]) * k];
    // which way it points: the phone's compass, else the way it is moving, else the road
    const want = t.heading ?? (metres(prev, t.p) > 3 ? bearing(prev, t.p) : head);
    head += ((((want - head) % 360) + 540) % 360 - 180) * Math.min(1, k * 2);
    const settled = metres(shown, t.p) < 0.5;
    if (settled) shown = t.p;
    // where the rider meets the planned road; off it (a detour), a dashed line leads back to it
    const s = snap(path, cum, shown);
    const d = s.d, off = s.off > 40;
    const join = pointAlong(path, cum, d).p;
    left = total - d + (off ? s.off : 0);
    const key = Math.round((shown[0] + shown[1]) * 1e6) + head + (state.show ? 1 : 0);
    if (key !== drawn) {
      drawn = key;
      rider.hidden = !state.show;
      const [x, y] = px(shown);
      rider.style.transform = `translate(${x}px,${y}px)`;
      (rider.querySelector('.rm-arrow') as HTMLElement).style.transform = `rotate(${head}deg)`;
      if (!state.show) {
        // before the rider leaves: the whole road ahead, nothing travelled
        [casing, ahead].forEach((p) => p.setAttribute('points', line(path)));
        behind.setAttribute('points', '');
        offroad.setAttribute('visibility', 'hidden');
      } else {
        const i = cum.findIndex((c) => c > d);
        const rest = i < 0 ? [door] : path.slice(i);
        const from = off ? join : shown;
        [casing, ahead].forEach((p) => p.setAttribute('points', line([from, ...rest])));
        behind.setAttribute('points', line([...path.slice(0, i < 0 ? path.length : i), from]));
        const [[x1, y1], [x2, y2]] = [px(shown), px(join)];
        Object.entries({ x1, y1, x2, y2 }).forEach(([a, v]) => offroad.setAttribute(a, v.toFixed(1)));
        offroad.setAttribute('visibility', off ? 'visible' : 'hidden');
      }
    }
    rider.classList.toggle('moving', state.riding && !state.stale);
    rider.classList.toggle('stale', state.stale);
    raf = settled ? 0 : requestAnimationFrame(paint);
  }

  const ro = new ResizeObserver(layout);
  ro.observe(mount);
  setDoor(opts.door);

  return {
    /** Move the rider; returns the metres still to ride. */
    update(next: MapState) {
      state = next;
      // a fix outside the view widens it
      const f = next.fix ? ([next.fix.lat, next.fix.lng] as LatLng) : null;
      const out = f && (() => {
        const [x, y] = px(f);
        return x < 12 || y < 40 || x > W - 12 || y > H - 12;
      })();
      if (out || (!f && extra)) {
        extra = out ? f : null;
        layout();
      }
      if (!raf) {
        last = 0;
        paint();
      }
      return left;
    },
    setDoor,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      [tiles, svg, shopPin, doorPin, rider, credit].forEach((n) => n.remove());
    },
  };
}
