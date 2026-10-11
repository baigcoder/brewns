/* What a signed-in customer keeps in their account besides their club card:
   favourite drinks and saved delivery addresses. They follow the customer to any
   phone. The rules for both live here, pure, so the server and the tests agree. */

import { DELIVERY, catalogItem } from './catalog';

export const MAX_FAVS = 24;
export const MAX_ADDRESSES = 4;

export type SavedAddress = { id: string; label: string; address: string; area: number };
export type Member = { favs: string[]; addrs: SavedAddress[] };

export const emptyMember = (): Member => ({ favs: [], addrs: [] });

/** Only real menu items, each once, newest last, at most MAX_FAVS. */
export function cleanFavs(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) if (typeof id === 'string' && catalogItem(id) && !out.includes(id)) out.push(id);
  return out.slice(-MAX_FAVS);
}

/** The list after turning one item on or off. Adding to a full list drops the oldest, so saving never silently fails. */
export function setFav(list: string[], id: string, on: boolean): string[] {
  if (!catalogItem(id)) return list;
  const rest = list.filter((x) => x !== id);
  return cleanFavs(on ? [...rest, id] : rest);
}

/** Merges what a phone has saved with what the account has, so signing in never loses either. */
export const mergeFavs = (account: string[], device: unknown): string[] => cleanFavs([...account, ...cleanFavs(device)]);

/** A saved address from what the customer typed, or the sentence to show if it is not usable. */
export function cleanAddress(raw: { label?: unknown; address?: unknown; area?: unknown }): { ok: true; value: Omit<SavedAddress, 'id'> } | { ok: false; error: string } {
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const label = text(raw.label, 20) || 'Home';
  const address = text(raw.address, 160);
  const area = Number(raw.area);
  if (address.length < 10) return { ok: false, error: 'House, street and block, so the rider finds you.' };
  if (!Number.isInteger(area) || area < 0 || area >= DELIVERY.areas.length) return { ok: false, error: 'Pick the delivery area.' };
  return { ok: true, value: { label, address, area } };
}

/** The same place typed again (ignoring case and spacing) is one address, not two. */
const same = (a: Omit<SavedAddress, 'id'>, b: Omit<SavedAddress, 'id'>) => a.area === b.area && a.address.toLowerCase() === b.address.toLowerCase();

/** Adds an address, or renames the matching one. When full, the customer has to delete one first. */
export function addAddress(list: SavedAddress[], value: Omit<SavedAddress, 'id'>, newId: () => string): { ok: true; list: SavedAddress[] } | { ok: false; error: string } {
  const hit = list.find((a) => same(a, value));
  if (hit) return { ok: true, list: list.map((a) => (a === hit ? { ...a, label: value.label } : a)) };
  if (list.length >= MAX_ADDRESSES) return { ok: false, error: `You can save ${MAX_ADDRESSES} addresses. Delete one first.` };
  return { ok: true, list: [...list, { id: newId(), ...value }] };
}

export const removeAddress = (list: SavedAddress[], id: string) => list.filter((a) => a.id !== id);
