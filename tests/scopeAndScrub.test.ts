import { describe, expect, it } from 'bun:test';
import { scrubEvent } from '@/lib/sentryScrub';
import { closesVisibleTo, type TillClose } from '@/lib/till';

const close = (name: string, shops?: number[]): TillClose => ({ t: 1, day: '2026-01-01', uid: name, name, orders: 1, cash: 1, card: 0, wallet: 0, refundsCash: 0, float: 0, expected: 1, counted: 1, variance: 0, note: '', shops });

describe('till closes by shop', () => {
  const all = [close('mm', [0]), close('dha', [1]), close('both', [0, 1]), close('allshops', []), close('legacy')];
  it('an owner sees every close', () => expect(closesVisibleTo(all, { role: 'owner', shops: [0] })).toHaveLength(5));
  it('someone on all shops sees every close', () => expect(closesVisibleTo(all, { role: 'manager', shops: [] })).toHaveLength(5));
  it('a manager tied to one shop sees only closes from that shop', () => {
    expect(closesVisibleTo(all, { role: 'manager', shops: [1] }).map((c) => c.name)).toEqual(['dha', 'both']);
  });
  it('closes with no shops recorded are hidden from scoped viewers', () => {
    expect(closesVisibleTo(all, { role: 'manager', shops: [2] })).toEqual([]);
  });
});

describe('Sentry scrubbing', () => {
  it('removes order keys, cookies, addresses and request bodies', () => {
    const e = scrubEvent({
      request: { url: 'https://x.test/api/orders/1001?k=SECRETKEY', query_string: 'k=SECRETKEY', cookies: { brewns_staff: 'a.b' }, headers: { cookie: 'brewns_staff=a.b', 'x-forwarded-for': '1.2.3.4', accept: '*/*' }, data: { phone: '0300' } },
      user: { ip_address: '1.2.3.4', geo: { city: 'Lahore' } },
      tags: { user: 'ip:1.2.3.4', url: 'https://x.test/api/orders/1001?k=SECRETKEY', source: 'kept' },
      breadcrumbs: [{ data: { url: 'https://x.test/api/orders/1001?k=SECRETKEY' } }],
    });
    expect(JSON.stringify(e)).not.toContain('SECRETKEY');
    expect(JSON.stringify(e)).not.toContain('1.2.3.4');
    expect(JSON.stringify(e)).not.toContain('brewns_staff');
    expect(JSON.stringify(e)).not.toContain('0300');
    expect(e.request?.url).toBe('https://x.test/api/orders/1001');
    expect(e.request?.headers as unknown).toEqual({ accept: '*/*' });
    expect(e.tags?.source).toBe('kept');
  });
  it('copes with an event that has none of those parts', () => expect(scrubEvent({})).toEqual({}));
});
