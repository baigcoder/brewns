/* The café's switches, set from the console: whether orders come through the
   console at all, each shop's pause / wait / tables, sold-out items, promo
   codes, and what each role may do. One small document, cached per request. */

import { SHOP_COUNT } from '@/lib/catalog';
import { normaliseRolePerms, type RolePerms } from '@/lib/rbac';
import { kv } from './store';

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
  promos: Promo[];
  rolePerms: RolePerms;
  updatedAt: number;
};

const DEFAULT_SHOP: ShopSettings = { paused: false, extraMin: 0, autoAccept: true, tables: 12 };

export const defaultSettings = (): Settings => ({
  online: true,
  shops: Array.from({ length: SHOP_COUNT }, (_, i) => ({ ...DEFAULT_SHOP, tables: [14, 10, 12][i] ?? 10 })),
  soldOut: [],
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
    promos: Array.isArray(raw.promos) ? raw.promos : base.promos,
    rolePerms: normaliseRolePerms(raw.rolePerms),
    updatedAt: raw.updatedAt || 0,
  };
}

export async function updateSettings(change: (s: Settings) => void | Settings) {
  const s = await getSettings();
  const next = change(s) || s;
  next.updatedAt = Date.now();
  await kv.set('settings', next);
  return next;
}
