import { describe, expect, it } from 'bun:test';
import { safeEqual } from '@/lib/server/http';

describe('safeEqual', () => {
  it('matches equal secrets only', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
    expect(safeEqual('abc123', 'abc124')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
  it('rejects empty and non-string values', () => {
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual(undefined, 'x')).toBe(false);
    expect(safeEqual(12, 12)).toBe(false);
  });
});

import { reportCsv } from '@/lib/server/reports';

describe('reportCsv', () => {
  const base = {
    range: 'today' as const,
    kpis: { gross: 1000, net: 800, tax: 160, fees: 40, discount: 0, orders: 2, avg: 500.4, cancelled: 0 } as never,
    byDay: [{ day: '2026-03-04', sales: 1000, orders: 2 }],
    byShop: [{ loc: 0, gross: 1000, orders: 2 } as never],
    top: [{ id: 'x', name: '=HYPERLINK("evil")', cat: 'drinks', qty: 2, sales: 1000 }],
  };
  it('writes totals, days, shops and items', () => {
    const csv = reportCsv(base);
    expect(csv).toContain('Gross,Net,Tax');
    expect(csv).toContain('1000,800,160,40,0,2,500,0');
    expect(csv).toContain('2026-03-04,1000,2');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('defuses spreadsheet formulas and quotes commas', () => {
    const csv = reportCsv({ ...base, top: [{ ...base.top[0], name: 'Latte, large' }, base.top[0]] });
    expect(csv).toContain('"Latte, large"');
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`);
  });
});
