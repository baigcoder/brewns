import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAX_ADDRESSES, MAX_FAVS, addAddress, cleanAddress, cleanFavs, mergeFavs, removeAddress, setFav, type SavedAddress } from '@/lib/member';
import { CATALOG } from '@/lib/catalog';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-member-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let member: typeof import('@/lib/server/member');
let store: typeof import('@/lib/server/store');
beforeAll(async () => {
  member = await import('@/lib/server/member');
  store = await import('@/lib/server/store');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const ids = CATALOG.map((p) => p.id);

describe('favourites', () => {
  it('keeps only real menu items, once each', () => {
    expect(cleanFavs([ids[0], 'not-a-product', ids[0], 42, null, ids[1]])).toEqual([ids[0], ids[1]]);
    expect(cleanFavs('nope')).toEqual([]);
    expect(cleanFavs(undefined)).toEqual([]);
  });

  it('turns one on and off, and ignores something that is not on the menu', () => {
    const on = setFav([], ids[0], true);
    expect(on).toEqual([ids[0]]);
    expect(setFav(on, ids[0], false)).toEqual([]);
    expect(setFav(on, 'made-up', true)).toEqual(on);
    expect(setFav(on, ids[0], true)).toEqual([ids[0]]); // saving twice is still one
  });

  it('drops the oldest when the list is full, so saving never silently fails', () => {
    const full = ids.slice(0, MAX_FAVS);
    const after = setFav(full, ids[MAX_FAVS], true);
    expect(after).toHaveLength(MAX_FAVS);
    expect(after).not.toContain(ids[0]);
    expect(after.at(-1)).toBe(ids[MAX_FAVS]);
  });

  it('brings a phone’s favourites into the account without losing either side', () => {
    expect(mergeFavs([ids[0], ids[1]], [ids[1], ids[2], 'junk'])).toEqual([ids[0], ids[1], ids[2]]);
    expect(mergeFavs([], 'garbage')).toEqual([]);
  });
});

describe('saved addresses', () => {
  const good = { label: 'Home', address: 'House 12, Street 4, Block B', area: 0 };
  let n = 0;
  const id = () => `ad_${++n}`;

  it('accepts a proper address and tidies it', () => {
    const r = cleanAddress({ label: '  Work\n ', address: '  Office 3,   2nd floor,\tMM Alam Road ', area: 2 });
    expect(r).toEqual({ ok: true, value: { label: 'Work', address: 'Office 3, 2nd floor, MM Alam Road', area: 2 } });
  });

  it('calls it Home when no name is given', () => {
    const r = cleanAddress({ ...good, label: '' });
    expect(r.ok && r.value.label).toBe('Home');
  });

  it('refuses one too short for a rider to find, or in no real area', () => {
    expect(cleanAddress({ ...good, address: 'Gulberg' })).toMatchObject({ ok: false });
    expect(cleanAddress({ ...good, area: 99 })).toMatchObject({ ok: false });
    expect(cleanAddress({ ...good, area: -1 })).toMatchObject({ ok: false });
    expect(cleanAddress({ ...good, area: 'x' })).toMatchObject({ ok: false });
    expect(cleanAddress({ label: 7, address: 7, area: 0 })).toMatchObject({ ok: false });
  });

  it('caps what is stored', () => {
    const r = cleanAddress({ label: 'L'.repeat(80), address: 'a'.repeat(500), area: 0 });
    expect(r.ok && r.value.label.length).toBe(20);
    expect(r.ok && r.value.address.length).toBe(160);
  });

  it('adds up to four, and the same place typed again is one address, renamed', () => {
    let list: SavedAddress[] = [];
    for (let i = 0; i < MAX_ADDRESSES; i++) {
      const r = addAddress(list, { label: `Place ${i}`, address: `House ${i + 10}, Street ${i}, Block A`, area: 0 }, id);
      expect(r.ok).toBe(true);
      if (r.ok) list = r.list;
    }
    expect(list).toHaveLength(MAX_ADDRESSES);
    const full = addAddress(list, { label: 'Fifth', address: 'House 99, Street 9, Block Z', area: 1 }, id);
    expect(full).toMatchObject({ ok: false });
    const renamed = addAddress(list, { label: 'Mum', address: 'HOUSE 10, street 0, block a', area: 0 }, id);
    expect(renamed.ok && renamed.list).toHaveLength(MAX_ADDRESSES);
    expect(renamed.ok && renamed.list[0].label).toBe('Mum');
  });

  it('deletes by id and leaves the rest', () => {
    const list = [{ id: 'a', label: 'A', address: 'x'.repeat(12), area: 0 }, { id: 'b', label: 'B', address: 'y'.repeat(12), area: 1 }];
    expect(removeAddress(list, 'a').map((x) => x.id)).toEqual(['b']);
    expect(removeAddress(list, 'zzz')).toHaveLength(2);
  });
});

describe('what is stored for a customer', () => {
  it('starts empty, comes back as saved, and goes with the account', async () => {
    expect(await member.readMember('cu_1')).toEqual({ favs: [], addrs: [] });
    await store.kv.set(member.memberKey('cu_1'), { favs: [ids[0]], addrs: [] });
    expect((await member.readMember('cu_1')).favs).toEqual([ids[0]]);
    await member.deleteMember('cu_1');
    expect(await member.readMember('cu_1')).toEqual({ favs: [], addrs: [] });
  });
});
