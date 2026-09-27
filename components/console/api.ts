'use client';

import { useEffect, useState } from 'react';

/** Calls the console's API. Errors come back as thrown Errors with the server's own sentence. */
export async function api<T = Record<string, unknown>>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path.startsWith('/api/staff')) {
    // Signed out elsewhere (role changed, switched off, new password): back to the door.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load drops every screen's state for the old session
    window.location.assign(`/staff/signin?next=${encodeURIComponent(location.pathname)}`);
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Something went wrong (${res.status}).`);
  return data as T;
}

/** The time now, refreshed every `ms`: render with this instead of calling Date.now(). */
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;
export const rsShort = (n: number) => (n >= 1e6 ? `Rs ${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `Rs ${Math.round(n / 1000)}k` : rs(n));
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const PK = 5 * 3600000;
/** A time in Lahore, whatever the device's clock is set to. */
export const pkTime = (t: number) => new Date(t + PK).toISOString().slice(11, 16);
export const pkDate = (t: number) => {
  const d = new Date(t + PK);
  return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
};
export const ago = (t: number, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
};
