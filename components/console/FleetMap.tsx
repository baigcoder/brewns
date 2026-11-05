'use client';

import { useEffect, useRef, useState } from 'react';
import { DELIVERY } from '@/lib/catalog';
import { orderNo } from '@/lib/orderFlow';
import { ROUTES } from '@/components/brewns/deliveryRoutes';
import { TILE, world, type LatLng } from '@/components/brewns/riderMap';
import type { StaffOrder } from './Live';

type Fix = { t: number; lat: number; lng: number; heading: number | null };

/** Each shop's door: where its delivery routes start. */
const SHOPS: LatLng[] = [0, 1, 2].map((s) => ROUTES[DELIVERY.areas.findIndex((a) => a[1] === s)][0]);

/**
 * Every rider on the road at once, for the owner and dispatchers: where each one is
 * (their phone's GPS), which way they're heading, and the door they're going to.
 */
export function FleetMap({ orders, fixes, now }: { orders: StaffOrder[]; fixes: Record<string, Fix>; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const road = orders.filter((o) => o.mode === 'delivery' && (o.status === 'onway' || o.status === 'arriving'));
  const riders = road.map((o) => {
    const f = fixes[o.number];
    const door: LatLng | null = o.pin ? [o.pin.lat, o.pin.lng] : o.area !== null ? ROUTES[o.area].at(-1)! : null;
    return { o, at: f ? ([f.lat, f.lng] as LatLng) : null, heading: f?.heading ?? null, age: f ? now - f.t : Infinity, door };
  });
  const pts: LatLng[] = [...SHOPS, ...riders.flatMap((r) => [r.at, r.door].filter(Boolean) as LatLng[])];

  // the largest zoom that shows everything
  const { w, h } = size;
  let z = 15, ox = 0, oy = 0;
  if (w && h) {
    for (z = 16; z > 10; z--) {
      const xs = pts.map((p) => world(p, z));
      const x0 = Math.min(...xs.map((p) => p[0])), x1 = Math.max(...xs.map((p) => p[0])), y0 = Math.min(...xs.map((p) => p[1])), y1 = Math.max(...xs.map((p) => p[1]));
      if (x1 - x0 <= w - 70 && y1 - y0 <= h - 70) {
        ox = (x0 + x1) / 2 - w / 2;
        oy = (y0 + y1) / 2 - h / 2;
        break;
      }
    }
  }
  const px = (p: LatLng) => {
    const [x, y] = world(p, z);
    return { x: x - ox, y: y - oy };
  };
  const tiles: { x: number; y: number; src: string }[] = [];
  if (w && h)
    for (let tx = Math.floor(ox / 256); tx * 256 < ox + w; tx++)
      for (let ty = Math.floor(oy / 256); ty * 256 < oy + h; ty++) tiles.push({ x: tx * 256 - ox, y: ty * 256 - oy, src: TILE(z, tx, ty) });

  return (
    <div ref={box} className="cx-fleet" aria-label={`Live map: ${road.length} rider${road.length === 1 ? '' : 's'} on the road`} role="img">
      <div className="rm-tiles">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- map tiles
          <img key={t.src} src={t.src} alt="" width={256} height={256} style={{ transform: `translate(${Math.round(t.x)}px,${Math.round(t.y)}px)` }} />
        ))}
      </div>
      {w > 0 && (
        <svg className="rm-svg" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          {riders.map(({ o, at, door }) =>
            at && door ? <line key={o.number} {...{ x1: px(at).x, y1: px(at).y, x2: px(door).x, y2: px(door).y }} className="rm-offroad" /> : null,
          )}
        </svg>
      )}
      {w > 0 &&
        SHOPS.map((s, i) => (
          <div key={`s${i}`} className="rm-pin rm-shop" style={{ transform: `translate(${px(s).x}px,${px(s).y}px)` }}>
            <span className="rm-dot">b</span>
          </div>
        ))}
      {w > 0 &&
        riders.map(({ o, door }) =>
          door ? (
            <div key={`d${o.number}`} className="rm-pin rm-door" style={{ transform: `translate(${px(door).x}px,${px(door).y}px)` }}>
              <span className="rm-dot" style={{ width: 22, height: 22, left: -11, top: -11, fontSize: 10 }}>⌂</span>
              <span className="rm-tag mono-fine" style={{ bottom: 14 }}>{orderNo(o.number)}</span>
            </div>
          ) : null,
        )}
      {w > 0 &&
        riders.map(({ o, at, heading, age }) =>
          at ? (
            <div key={`r${o.number}`} className={`rm-pin rm-rider moving${age > 120000 ? ' stale' : ''}`} style={{ transform: `translate(${px(at).x}px,${px(at).y}px)` }}>
              <span className="rm-pulse" />
              <span className="rm-arrow" style={{ transform: `rotate(${heading ?? 0}deg)` }}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M12 2 20 21 12 16.5 4 21z" />
                </svg>
              </span>
              <span className="rm-tag mono-fine">{(o.rider?.name.split(' ')[0] || 'Rider').toUpperCase()}</span>
            </div>
          ) : null,
        )}
      <p className="cx-fleet-key">
        {road.length ? `${riders.filter((r) => r.at && r.age < 120000).length} of ${road.length} sharing GPS now` : 'No riders on the road right now'}
      </p>
      <span className="rm-credit">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
      </span>
    </div>
  );
}
