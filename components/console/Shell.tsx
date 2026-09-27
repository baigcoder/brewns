'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useContext, useState, type ReactNode } from 'react';
import { canOpen, ROLE_INFO, SECTIONS, type Permission, type Role } from '@/lib/rbac';
import { api, initials } from './api';
import { LiveProvider, useLive } from './Live';
import { ToastProvider } from './Toasts';

export type Me = { id: string; name: string; email: string; role: Role; shops: number[] };

const MeCtx = createContext<{ me: Me; perms: Permission[] } | null>(null);
/** The signed-in staff member and what they may do, for showing only the buttons that will work. */
export function useMe() {
  const c = useContext(MeCtx);
  if (!c) throw new Error('useMe outside Shell');
  return { ...c, can: (...p: Permission[]) => p.every((x) => c.perms.includes(x)), canAny: (...p: Permission[]) => p.some((x) => c.perms.includes(x)) };
}

/** Sent here from a screen their role can't open. */
function Denied() {
  const denied = useSearchParams().get('denied');
  return denied ? <p className="cx-banner cx-noprint">Your role can’t open {denied}. Ask the owner if you need it.</p> : null;
}

function Nav({ perms, onGo }: { perms: Permission[]; onGo: () => void }) {
  const path = usePathname();
  const { data } = useLive();
  const orders = data?.orders || [];
  const badge: Record<string, { n: number; alert?: boolean }> = {
    orders: { n: orders.filter((o) => o.status === 'received').length, alert: true },
    kitchen: { n: orders.filter((o) => ['accepted', 'preparing'].includes(o.status) && Object.values(o.stations).some((s) => s !== 'done')).length },
    floor: { n: (data?.calls.length || 0) + orders.filter((o) => o.mode === 'dinein' && o.status === 'ready').length, alert: !!data?.calls.length },
    deliveries: { n: orders.filter((o) => o.mode === 'delivery' && !o.rider && ['accepted', 'preparing', 'ready'].includes(o.status)).length },
  };
  const visible = SECTIONS.filter((s) => canOpen(perms, s));
  return (
    <nav className="cx-nav" aria-label="Console">
      {(['Run', 'Manage', 'You'] as const).map((g) => {
        const list = visible.filter((s) => s.group === g);
        if (!list.length) return null;
        return (
          <div className="cx-nav-group" key={g}>
            <p>{g}</p>
            {list.map((s) => (
              <Link key={s.key} href={s.href} aria-current={path === s.href ? 'page' : undefined} onClick={onGo}>
                <span>{s.label}</span>
                {badge[s.key]?.n ? <span className={`cx-badge${badge[s.key].alert ? ' alert' : ''}`}>{badge[s.key].n}</span> : null}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

export function Shell({ me, perms, store, notice, children }: { me: Me; perms: Permission[]; store: { ephemeral: boolean; kind: string }; notice?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const signOut = async () => {
    const r = await api<{ next: string }>('/api/auth/signout', { kind: 'staff' }).catch(() => ({ next: '/staff/signin' }));
    window.location.assign(r.next);
  };
  return (
    <MeCtx.Provider value={{ me, perms }}>
    <ToastProvider>
      <LiveProvider>
        <div className={`cx${open ? ' nav-open' : ''}`}>
          <div className="cx-top">
            <button type="button" className="cx-btn sm" onClick={() => setOpen(true)} aria-label="Open the menu">
              ☰ Menu
            </button>
            <Link href="/" aria-label="brewns, the site" className="wordmark mask" />
            <span className="cx-avatar" title={me.name}>
              {initials(me.name)}
            </span>
          </div>
          <aside className="cx-side" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="cx-brand">
              <Link href="/" aria-label="brewns, the site" className="wordmark mask" />
              <span>CONSOLE</span>
            </div>
            <Nav perms={perms} onGo={() => setOpen(false)} />
            <div className="cx-me">
              <div className="cx-me-row">
                <span className="cx-avatar">{initials(me.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <p className="cx-me-name">{me.name}</p>
                  <p className="cx-eyebrow">{ROLE_INFO[me.role].label}</p>
                </div>
              </div>
              <button type="button" className="cx-btn sm block" onClick={signOut}>
                Sign out
              </button>
            </div>
          </aside>
          <main className="cx-main">
            {store.ephemeral && (
              <p className="cx-banner cx-noprint">
                Data is being kept in temporary storage and will be lost when the server restarts. Connect Upstash Redis in Vercel (Storage → Upstash → Redis) and redeploy to keep it.
              </p>
            )}
            {notice && <p className="cx-banner cx-noprint">{notice}</p>}
            <Suspense fallback={null}>
              <Denied />
            </Suspense>
            {children}
          </main>
        </div>
      </LiveProvider>
    </ToastProvider>
    </MeCtx.Provider>
  );
}
