'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ServerOrder } from '@/lib/orderFlow';
import type { ShopSettings } from '@/lib/server/settings';
import { api } from './api';

export type StaffOrder = Omit<ServerOrder, 'key'>;
export type Call = { id: string; loc: number; table: number; kind: 'waiter' | 'bill'; t: number };
export type Rider = { id: string; name: string; plate: string; shops: number[]; online: boolean };
export type LiveData = { v: number; now: number; orders: StaffOrder[]; calls: Call[]; riders: Rider[]; soldOut: string[]; shops: ShopSettings[] };

type Live = {
  data: LiveData | null;
  error: string;
  /** Order numbers that arrived since this screen opened (for the highlight and the chime). */
  fresh: Set<number>;
  refresh: () => Promise<void>;
  act: (number: number, action: Record<string, unknown>) => Promise<StaffOrder>;
};

const Ctx = createContext<Live | null>(null);

/**
 * One poll for every screen: /api/staff/live every 4 seconds while the tab is
 * visible (every 20 when it isn't). Unchanged data costs one tiny request.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const v = useRef<number | null>(null);
  const known = useRef<Set<number> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api<LiveData & { same?: boolean }>(`/api/staff/live${v.current !== null ? `?v=${v.current}` : ''}`);
      setError('');
      if (r.same) return;
      v.current = r.v;
      if (known.current) {
        const arrived = r.orders.filter((o) => !known.current!.has(o.number)).map((o) => o.number);
        if (arrived.length) {
          setFresh((f) => new Set([...f, ...arrived]));
          window.dispatchEvent(new CustomEvent('brewns:new-orders', { detail: arrived }));
        }
      }
      known.current = new Set(r.orders.map((o) => o.number));
      setData(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let timer = 0;
    const loop = async () => {
      await refresh();
      timer = window.setTimeout(loop, document.hidden ? 20000 : 4000);
    };
    loop();
    const wake = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        loop();
      }
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [refresh]);

  const act = useCallback(async (number: number, action: Record<string, unknown>) => {
    const { order } = await api<{ order: StaffOrder }>(`/api/staff/orders/${number}`, action);
    // Show the change at once; the next poll brings everyone else's.
    setData((d) => (d ? { ...d, orders: d.orders.some((o) => o.number === number) ? d.orders.map((o) => (o.number === number ? order : o)) : [...d.orders, order] } : d));
    v.current = null;
    return order;
  }, []);

  return <Ctx.Provider value={{ data, error, fresh, refresh, act }}>{children}</Ctx.Provider>;
}

export function useLive() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLive outside LiveProvider');
  return c;
}

/** A short two-note chime for new tickets, made on the spot (no audio file). */
export function chime() {
  try {
    const Ac = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ac();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.16);
      o.stop(ctx.currentTime + i * 0.16 + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}
