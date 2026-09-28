'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from 'react';
import { canOpen, homeFor, ROLE_INFO, SECTIONS, type Permission, type Role } from '@/lib/rbac';
import { api, initials } from './api';
import { LiveProvider, useLive } from './Live';
import { ToastProvider, useToast } from './Toasts';

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
  const [now, setNow] = useState(0);
  useEffect(() => {
    let interval = 0;
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      interval = window.setInterval(() => setNow(Date.now()), 60_000);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);
  const orders = data?.orders || [];
  const badge: Record<string, { n: number; alert?: boolean }> = {
    orders: {
      n: orders.filter((o) => ['received', 'accepted', 'preparing', 'ready'].includes(o.status)).length,
      alert: orders.some((o) => o.status === 'received'),
    },
    kitchen: {
      n: orders.filter((o) => ['accepted', 'preparing'].includes(o.status) && Object.values(o.stations).some((s) => s !== 'done')).length,
      alert: orders.some((o) => o.status === 'preparing' && now - o.placed > 15 * 60000),
    },
    floor: {
      n: (data?.calls.length || 0) + orders.filter((o) => o.mode === 'dinein' && o.status === 'ready').length,
      alert: !!data?.calls.length,
    },
    deliveries: {
      n: orders.filter((o) => o.mode === 'delivery' && ['received', 'accepted', 'preparing', 'ready', 'onway'].includes(o.status)).length,
      alert: orders.some((o) => o.mode === 'delivery' && !o.rider && ['accepted', 'preparing', 'ready'].includes(o.status)),
    },
    bookings: {
      n: (data?.aiLive || 0) + (data?.upcomingBookings || 0),
      alert: !!data?.aiLive,
    },
    moments: {
      n: data?.pendingMoments || 0,
      alert: (data?.pendingMoments || 0) > 0,
    },
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

function ShellContent({
  initialMe,
  initialPerms,
  store,
  notice,
  children,
}: {
  initialMe: Me;
  initialPerms: Permission[];
  store: { ephemeral: boolean; kind: string };
  notice?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data, error: liveError } = useLive();
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();

  // Dynamic Realtime RBAC Sync: updates role and permissions on the fly without page reload
  const me = data?.me ? { ...initialMe, ...data.me } : initialMe;
  const perms = data?.perms || initialPerms;
  const section = SECTIONS.find((s) => path === s.href || path.startsWith(`${s.href}/`));
  const accessRevoked = !!section && !canOpen(perms, section);
  const safeHome = homeFor(me.role, perms);

  useEffect(() => {
    if (accessRevoked) router.replace(safeHome);
  }, [accessRevoked, router, safeHome]);

  useEffect(() => {
    const handleRoleChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.newRole) {
        const label = ROLE_INFO[detail.newRole as Role]?.label || detail.newRole;
        toast(`Role updated in real-time: You are now ${label}. Navigation permissions updated.`, 'plain');
      }
    };
    window.addEventListener('brewns:role-changed', handleRoleChange);
    return () => window.removeEventListener('brewns:role-changed', handleRoleChange);
  }, [toast]);

  const signOut = async () => {
    const r = await api<{ next: string }>('/api/auth/signout', { kind: 'staff' }).catch(() => ({ next: '/staff/signin' }));
    window.location.assign(r.next);
  };

  return (
    <MeCtx.Provider value={{ me, perms }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p className="cx-eyebrow" style={{ margin: 0 }}>{ROLE_INFO[me.role].label}</p>
                  <span className={`cx-live-tag${liveError ? ' stale' : ''}`} title={liveError || 'Role, permissions, and live board are syncing automatically'}>
                    {liveError ? 'SYNC ISSUE' : data ? 'LIVE' : 'CONNECTING'}
                  </span>
                </div>
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
          {accessRevoked ? (
            <section className="cx-card" role="status" style={{ maxWidth: 560, margin: '12vh auto', padding: 28 }}>
              <p className="cx-eyebrow"><b>{'//'}</b> Access updated</p>
              <h1 className="cx-h2">This screen is no longer available to your role.</h1>
              <p className="cx-small cx-muted">Taking you to the first screen your current role can use…</p>
            </section>
          ) : children}
        </main>
      </div>
    </MeCtx.Provider>
  );
}

export function Shell({
  me,
  perms,
  store,
  notice,
  children,
}: {
  me: Me;
  perms: Permission[];
  store: { ephemeral: boolean; kind: string };
  notice?: string;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <LiveProvider>
        <ShellContent initialMe={me} initialPerms={perms} store={store} notice={notice}>
          {children}
        </ShellContent>
      </LiveProvider>
    </ToastProvider>
  );
}
