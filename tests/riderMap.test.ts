import { describe, expect, test } from 'bun:test';
import { DELIVERY } from '@/lib/catalog';
import { ROUTES } from '@/components/brewns/deliveryRoutes';
import { bearing, metres, pointAlong, snap, tripPath, type LatLng } from '@/components/brewns/riderMap';
import { lahorePoint } from '@/lib/server/orders';

const along = (p: LatLng[]) => p.reduce<number[]>((c, q, i) => (c.push(i ? c[i - 1] + metres(p[i - 1], q) : 0), c), []);

describe('delivery routes', () => {
  test('one road route per delivery area, its length matching the km the site quotes', () => {
    expect(ROUTES.length).toBe(DELIVERY.areas.length);
    ROUTES.forEach((r, i) => {
      const km = along(r).at(-1)! / 1000;
      expect(Math.abs(km - DELIVERY.areas[i][4])).toBeLessThan(0.3);
    });
  });
});

describe('rider map geometry', () => {
  const path: LatLng[] = [
    [31.5, 74.3],
    [31.5, 74.31],
    [31.51, 74.31],
  ];
  const cum = along(path);
  test('a point along the road, and which way the road runs', () => {
    const mid = pointAlong(path, cum, cum[1] / 2);
    expect(mid.p[0]).toBeCloseTo(31.5, 6);
    expect(mid.p[1]).toBeCloseTo(74.305, 6);
    expect(mid.heading).toBeCloseTo(90, 0); // east
    expect(pointAlong(path, cum, cum[1] + 10).heading).toBeCloseTo(0, 0); // then north
    expect(pointAlong(path, cum, 1e9).p).toEqual(path[2]);
  });
  test('a GPS fix snaps to how far along the road it is, and how far off it', () => {
    const s = snap(path, cum, [31.5005, 74.305]);
    expect(Math.abs(s.d - cum[1] / 2)).toBeLessThan(2);
    expect(s.off).toBeGreaterThan(50);
    expect(s.off).toBeLessThan(60);
  });
  test('an exact door cuts the route where it passes nearest and ends at the door', () => {
    const door: LatLng = [31.5001, 74.3101];
    expect(tripPath(path, door)).toEqual([path[0], path[1], door]);
    expect(tripPath(path, null)).toBe(path);
  });
  test('bearing is clockwise from north', () => {
    expect(bearing([31.5, 74.3], [31.49, 74.3])).toBeCloseTo(180, 0);
  });
});

describe('locations the server accepts', () => {
  test('in and around Lahore only, as numbers', () => {
    expect(lahorePoint(31.52, 74.35)).toEqual({ lat: 31.52, lng: 74.35 });
    expect(lahorePoint('31.523456789', '74.351234567')).toEqual({ lat: 31.52346, lng: 74.35123 });
    expect(lahorePoint(24.86, 67.0)).toBeNull(); // Karachi
    expect(lahorePoint(NaN, 74.3)).toBeNull();
    expect(lahorePoint(undefined, null)).toBeNull();
  });
});
