'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; tone: 'good' | 'bad' | 'plain' };
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'plain') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 6500 : 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="cx-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`cx-toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Runs an action, shows its error as a toast, and returns whether it worked. */
export function useRun() {
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => Promise<T>, done?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (done) toast(done, 'good');
        return r;
      } catch (e) {
        toast((e as Error).message, 'bad');
        return undefined;
      }
    },
    [toast],
  );
}
