/* The café's switches, set from the console: whether orders come through the
   console at all, each shop's pause / wait / tables, sold-out items, promo
   codes, and what each role may do. One small document, cached per request. */

import { SHOP_COUNT } from '@/lib/catalog';
import { HttpError } from './http';
import { normaliseRolePerms, type RolePerms } from '@/lib/rbac';
import { kv, withLock } from './store';

export type ShopSettings = {
  /** Online orders paused (busy, closed early, power cut). */
  paused: boolean;
  /** Extra minutes on every pickup and delivery estimate. */
  extraMin: number;
  /** New orders skip "new" and go straight to the stations. */
  autoAccept: boolean;
  tables: number;
};

export type Promo = { code: string; pct: number; active: boolean; uses: number; createdAt: number; note?: string };

export type Settings = {
  /** Orders go to the console (live tracking) instead of only by email. */
  online: boolean;
  shops: ShopSettings[];
  soldOut: string[];
  /** Units left of the items the café counts. An item at zero is sold out on its own; items not listed are unlimited. */
  stock: Record<string, number>;
  promos: Promo[];
  rolePerms: RolePerms;
  updatedAt: number;
};

const DEFAULT_SHOP: ShopSettings = { paused: false, extraMin: 0, autoAccept: true, tables: 12 };

export const defaultSettings = (): Settings => ({
  online: true,
  shops: Array.from({ length: SHOP_COUNT }, (_, i) => ({ ...DEFAULT_SHOP, tables: [14, 10, 12][i] ?? 10 })),
  soldOut: [],
  stock: {},
  promos: [{ code: 'BREWNS10', pct: 10, active: true, uses: 0, createdAt: 0, note: 'The code the checkout suggests' }],
  rolePerms: normaliseRolePerms(null),
  updatedAt: 0,
});

export async function getSettings(): Promise<Settings> {
  const raw = await kv.get<Partial<Settings>>('settings');
  const base = defaultSettings();
  if (!raw) return base;
  return {
    online: raw.online ?? base.online,
    shops: base.shops.map((s, i) => ({ ...s, ...(raw.shops?.[i] || {}) })),
    soldOut: Array.isArray(raw.soldOut) ? raw.soldOut : [],
    stock: raw.stock && typeof raw.stock === 'object' ? raw.stock : {},
    promos: Array.isArray(raw.promos) ? raw.promos : base.promos,
    rolePerms: normaliseRolePerms(raw.rolePerms),
    updatedAt: raw.updatedAt || 0,
  };
}

export async function updateSettings(change: (s: Settings) => void | Settings) {
  return withLock('settings', async () => {
    const s = await getSettings();
    const next = change(s) || s;
    next.updatedAt = Date.now();
    await kv.set('settings', next);
    return next;
  });
}

/* ── stock counts ── */

export const LOW_STOCK = 5;

/**
 * Takes units off the counted items in one go, or none at all when any is short.
 * An item that reaches zero goes on the sold-out list by itself.
 */
export async function reserveStock(lines: { id: string; qty: number; name?: string }[]) {
  const want = new Map<string, number>();
  for (const l of lines) want.set(l.id, (want.get(l.id) || 0) + l.qty);
  return updateSettings((s) => {
    for (const [id, qty] of want) {
      const left = s.stock[id];
      if (left === undefined) continue;
      if (left < qty) {
        const name = (lines.find((l) => l.id === id)?.name || 'that item').toLowerCase();
        throw new HttpError(409, left > 0 ? `Only ${left} ${name} left. Lower the quantity to carry on.` : `Sorry, ${name} has just sold out. Take it out of the bag to carry on.`);
      }
    }
    for (const [id, qty] of want) {
      if (s.stock[id] === undefined) continue;
      s.stock[id] -= qty;
      if (s.stock[id] === 0 && !s.soldOut.includes(id)) s.soldOut.push(id);
    }
  });
}

/** Puts units back (a cancelled order) and takes an item off the sold-out list if it has stock again. */
export async function releaseStock(lines: { id: string; qty: number }[]) {
  const back = new Map<string, number>();
  for (const l of lines) back.set(l.id, (back.get(l.id) || 0) + l.qty);
  return updateSettings((s) => {
    for (const [id, qty] of back) {
      if (s.stock[id] === undefined) continue;
      s.stock[id] += qty;
      if (s.stock[id] > 0) s.soldOut = s.soldOut.filter((x) => x !== id);
    }
  });
}

/** Sets how many are left of an item, or stops counting it with `null`. Zero sells it out; any more puts it back. */
export async function setStock(id: string, count: number | null) {
  return updateSettings((s) => {
    if (count === null) {
      delete s.stock[id];
      return;
    }
    s.stock[id] = count;
    s.soldOut = count === 0 ? [...new Set([...s.soldOut, id])] : s.soldOut.filter((x) => x !== id);
  });
}
