'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CLUB, type ClubState } from '@/components/brewns/club';
import { LOC_TITLES } from '@/lib/catalog';
import { MODE_LABEL, orderNo, type Mode } from '@/lib/orderFlow';
import { api, pkDate, pkTime, rs } from '@/components/console/api';

type Order = { number: number; key: string; placed: number; status: string; statusLabel: string; mode: Mode; loc: number; table: number | null; totals: { total: number }; items: { id: string; qty: number; sel: Record<string, number>; name: string }[] };
type User = { id: string; name: string; email: string; phone: string; since: number };

const OPEN = ['received', 'accepted', 'preparing', 'ready', 'onway', 'arriving'];

/** The customer's page: their club card, their orders (track, order again), their details. */
export function AccountHome({ user, club: first }: { user: User; club: ClubState }) {
  const [club, setClub] = useState(first);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [me, setMe] = useState(user);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [bday, setBday] = useState({ d: '', m: '' });
  const [pw, setPw] = useState({ password: '', newPassword: '' });

  useEffect(() => {
    api<{ orders: Order[] }>('/api/account/orders').then((r) => setOrders(r.orders), () => setOrders([]));
    // Keep the site's copy of the card in step, so the checkout offers the right free drinks.
    try {
      localStorage.setItem('brewns-club', JSON.stringify(first));
    } catch {}
  }, [first]);

  const say = (text: string, bad = false) => setMsg({ text, bad });
  const again = (o: Order) => {
    try {
      const bag = JSON.parse(localStorage.getItem('brewns-bag') || '[]');
      o.items.forEach((it) => bag.push({ id: it.id, qty: it.qty, sel: it.sel }));
      localStorage.setItem('brewns-bag', JSON.stringify(bag));
    } catch {}
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: the café page's engine starts once per document
    window.location.assign('/?bag=open');
  };
  const join = async () => {
    const birthday = bday.d && bday.m ? `${bday.m}-${bday.d}` : '';
    try {
      const r = await api<{ club: ClubState }>('/api/account/club', { action: 'join', birthday });
      setClub(r.club);
      localStorage.setItem('brewns-club', JSON.stringify(r.club));
      say('Welcome to brewns Club. The first stamp is on us.');
    } catch (e) {
      say((e as Error).message, true);
    }
  };
  const signOut = async () => {
    await api('/api/auth/signout', { kind: 'customer' }).catch(() => {});
    try {
      localStorage.removeItem('brewns-club');
    } catch {}
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: the café page's engine starts once per document
    window.location.assign('/');
  };
  const m = club.member;

  return (
    <div className="acct cx" style={{ display: 'block' }}>
      <header className="acct-top">
        <Link href="/" aria-label="brewns, back to the site" className="wordmark mask" />
        <div className="cx-row">
          <Link href="/" className="cx-btn sm">
            Order
          </Link>
          <button type="button" className="cx-btn sm ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="acct-main">
        <div className="cx-stack" style={{ gap: 6 }}>
          <p className="cx-eyebrow">
            <b>{'//'}</b> Member since {pkDate(me.since)}
          </p>
          <h1 className="cx-h1">Hi {me.name.split(' ')[0]}.</h1>
        </div>
        {msg && <p className={msg.bad ? 'auth-err' : 'auth-ok'}>{msg.text}</p>}

        {m ? (
          <section className="acct-card" aria-label="Your brewns Club card">
            <div className="cx-row between">
              <span className="cx-eyebrow" style={{ color: 'rgb(255 255 255 / .75)' }}>
                BREWNS CLUB · {m.no}
              </span>
              <span className="cx-mono cx-small">{club.lifetime} stamps in all</span>
            </div>
            <p className="cx-h1" style={{ fontSize: 26 }}>
              {club.rewards ? `${club.rewards} free drink${club.rewards === 1 ? '' : 's'} waiting.` : `${CLUB.stampsPerReward - club.stamps} more to a free drink.`}
            </p>
            <div className="acct-stamps" role="img" aria-label={`${club.stamps} of ${CLUB.stampsPerReward} stamps`}>
              {Array.from({ length: CLUB.stampsPerReward }, (_, i) => (
                <i key={i} className={i < club.stamps ? 'on' : ''} />
              ))}
            </div>
            <p className="cx-small" style={{ color: 'rgb(255 255 255 / .75)' }}>
              A stamp for every drink, two before 9. Tick “use a free drink” at checkout. This card lives in your account, so it works on any phone.
            </p>
          </section>
        ) : (
          <section className="cx-card cx-stack">
            <p className="cx-h2">Join brewns Club, free</p>
            <p className="cx-small cx-muted">A stamp for every drink (two before 9), a free drink every ten, and one in your birthday week. Orders from the last day count too.</p>
            <div className="cx-row">
              <select className="cx-select" value={bday.d} onChange={(e) => setBday({ ...bday, d: e.target.value })} aria-label="Birthday day">
                <option value="">Birthday day</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={String(i + 1).padStart(2, '0')}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select className="cx-select" value={bday.m} onChange={(e) => setBday({ ...bday, m: e.target.value })} aria-label="Birthday month">
                <option value="">Month</option>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mo, i) => (
                  <option key={mo} value={String(i + 1).padStart(2, '0')}>
                    {mo}
                  </option>
                ))}
              </select>
              <button type="button" className="cx-btn primary" onClick={join}>
                Join the club
              </button>
            </div>
          </section>
        )}

        <section className="cx-card">
          <div className="cx-card-h">
            <p className="cx-h2">Your orders</p>
          </div>
          {!orders ? (
            <p className="cx-muted">Loading…</p>
          ) : !orders.length ? (
            <p className="cx-muted">
              No orders on this account yet. <Link className="cx-link" href="/">Order something</Link> while signed in and it shows up here.
            </p>
          ) : (
            <div className="cx-stack" style={{ gap: 12 }}>
              {orders.map((o) => (
                <div key={o.number} className="cx-row between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--cx-line)' }}>
                  <div className="cx-stack" style={{ gap: 3 }}>
                    <p style={{ fontWeight: 600 }}>
                      {orderNo(o.number)} · {rs(o.totals.total)}
                    </p>
                    <p className="cx-small cx-muted">
                      {pkDate(o.placed)} {pkTime(o.placed)} · {o.mode === 'dinein' ? `Table ${o.table}` : MODE_LABEL[o.mode]} · {LOC_TITLES[o.loc].split(',')[0]} · {o.items.map((i) => `${i.qty}× ${i.name.toLowerCase()}`).join(', ')}
                    </p>
                  </div>
                  <div className="cx-row">
                    <span className={`cx-pill ${o.status}`}>{o.statusLabel}</span>
                    <a className="cx-btn sm" href={`/?track=${o.number}&k=${o.key}`}>
                      {OPEN.includes(o.status) ? 'Track' : 'Receipt'}
                    </a>
                    <button type="button" className="cx-btn sm" onClick={() => again(o)}>
                      Order again
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="cx-grid two">
          <section className="cx-card cx-stack">
            <p className="cx-h2">Your details</p>
            <form
              className="cx-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const r = await api<{ user: User }>('/api/account/me', { name: f.get('name'), phone: f.get('phone') }, 'PATCH');
                  setMe(r.user);
                  say('Saved. Checkout fills these in for you.');
                } catch (err) {
                  say((err as Error).message, true);
                }
              }}
            >
              <label className="cx-field">
                <span>Name</span>
                <input name="name" defaultValue={me.name} maxLength={40} />
              </label>
              <label className="cx-field">
                <span>Mobile</span>
                <input name="phone" defaultValue={me.phone} maxLength={16} />
              </label>
              <label className="cx-field">
                <span>Email</span>
                <input value={me.email} disabled />
              </label>
              <button className="cx-btn">Save</button>
            </form>
          </section>
          <section className="cx-card cx-stack">
            <p className="cx-h2">Password</p>
            <form
              className="cx-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('/api/account/me', pw, 'PATCH');
                  setPw({ password: '', newPassword: '' });
                  say('Password changed. Other devices are signed out.');
                } catch (err) {
                  say((err as Error).message, true);
                }
              }}
            >
              <label className="cx-field">
                <span>Current password</span>
                <input type="password" autoComplete="current-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
              </label>
              <label className="cx-field">
                <span>New password</span>
                <input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </label>
              <button className="cx-btn" disabled={!pw.password || pw.newPassword.length < 8}>
                Change password
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
