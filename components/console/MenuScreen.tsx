'use client';

import React, { useEffect, useState } from 'react';
import { PRODUCTS, money } from '@/lib/catalog';
import type { PromoCode } from '@/lib/server/storage';

export function MenuScreen() {
  const [soldOutList, setSoldOutList] = useState<string[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('10');
  const [addingPromo, setAddingPromo] = useState(false);

  const fetchMenuData = async () => {
    try {
      const [availRes, promoRes] = await Promise.all([
        fetch('/api/menu/availability'),
        fetch('/api/menu/promos'),
      ]);
      if (availRes.ok) {
        const aData = await availRes.json();
        setSoldOutList(aData.soldOut || []);
      }
      if (promoRes.ok) {
        const pData = await promoRes.json();
        setPromos(pData.promos || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMenuData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleSoldOut = async (productId: string, currentlySoldOut: boolean) => {
    const nextVal = !currentlySoldOut;
    // Optimistic
    setSoldOutList((prev) =>
      nextVal ? [...prev, productId] : prev.filter((id) => id !== productId)
    );

    try {
      await fetch('/api/menu/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, soldOut: nextVal }),
      });
    } catch {
      fetchMenuData();
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setAddingPromo(true);

    try {
      const res = await fetch('/api/menu/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          discountPercent: Number(newDiscount || 10),
          active: true,
        }),
      });

      if (res.ok) {
        setNewCode('');
        fetchMenuData();
      }
    } catch {
      // Ignored
    } finally {
      setAddingPromo(false);
    }
  };

  const handleTogglePromo = async (promo: PromoCode) => {
    try {
      await fetch('/api/menu/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promo.code,
          discountPercent: promo.discountPercent,
          active: !promo.active,
        }),
      });
      fetchMenuData();
    } catch {
      // Ignored
    }
  };

  return (
    <div>
      <div className="co-page-title">
        <div>
          <h1>Menu &amp; Availability</h1>
          <p>Instantly 86 items when inventory runs out, and manage promotional discounts.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', alignItems: 'start' }}>
        {/* Left: Product Availability Table */}
        <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px' }}>Item Stock Status</h2>
          <table className="co-table">
            <thead>
              <tr>
                <th>ITEM NAME</th>
                <th>CATEGORY</th>
                <th>PRICE</th>
                <th>AVAILABILITY</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map((p) => {
                const isSoldOut = soldOutList.includes(p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginLeft: '8px' }}>
                        {p.station.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--co-cream-dim)' }}>{p.cat}</td>
                    <td>{money(p.price)}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn-co ${isSoldOut ? 'btn-co-danger' : 'btn-co-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => handleToggleSoldOut(p.id, isSoldOut)}
                      >
                        {isSoldOut ? 'SOLD OUT (86)' : 'IN STOCK'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: Promo Codes Management */}
        <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px' }}>Active Promo Codes</h2>

          <form onSubmit={handleCreatePromo} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            <input
              className="co-input"
              placeholder="Code (e.g. BREWNS20)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="co-input"
                type="number"
                placeholder="Discount %"
                value={newDiscount}
                onChange={(e) => setNewDiscount(e.target.value)}
              />
              <button type="submit" className="btn-co btn-co-primary" disabled={addingPromo} style={{ whiteSpace: 'nowrap' }}>
                Create Code
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {promos.map((pr) => (
              <div
                key={pr.code}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--co-card)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--co-border)',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: 'var(--co-amber-light)' }}>
                    {pr.code}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                    {pr.discountPercent}% Off {pr.active ? '· Active' : '· Paused'}
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn-co ${pr.active ? 'btn-co-primary' : 'btn-co-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => handleTogglePromo(pr)}
                >
                  {pr.active ? 'Enabled' : 'Paused'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
