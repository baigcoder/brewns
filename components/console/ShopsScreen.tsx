'use client';

import React, { useEffect, useState } from 'react';
import { generateQrSvg } from '@/lib/qr';

type ShopInfo = {
  id: number;
  name: string;
  address: string;
  paused: boolean;
  customPrepMin: number;
  tables: number;
};

export function ShopsScreen() {
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [activeQrShop, setActiveQrShop] = useState<ShopInfo | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('T-01');

  const fetchShops = async () => {
    try {
      const res = await fetch('/api/shops');
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchShops();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdateShop = async (shopId: number, fields: Partial<ShopInfo>) => {
    try {
      await fetch('/api/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, ...fields }),
      });
      fetchShops();
    } catch {
      // Ignored
    }
  };

  // Generate table list for QR codes modal
  const tables = activeQrShop ? Array.from({ length: activeQrShop.tables }, (_, i) => `T-${String(i + 1).padStart(2, '0')}`) : [];
  const qrUrl = activeQrShop
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://brewns.pk'}?dinein=1&table=${selectedTable}&shop=${activeQrShop.id}`
    : '';

  const qrSvg = qrUrl ? generateQrSvg(qrUrl, { size: 220 }) : '';

  return (
    <div>
      <div className="co-page-title">
        <div>
          <h1>Café Locations &amp; Tables</h1>
          <p>Manage branch operations, online order pausing, and table QR code kits.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {shops.map((shop) => (
          <div
            key={shop.id}
            style={{
              background: 'var(--co-panel)',
              border: '1px solid var(--co-border)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{shop.name}</h2>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: shop.paused ? 'var(--co-red-dim)' : 'var(--co-green-dim)',
                    color: shop.paused ? 'var(--co-red)' : 'var(--co-green)',
                  }}
                >
                  {shop.paused ? 'PAUSED' : 'ONLINE'}
                </span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--co-cream-dim)', margin: '0 0 20px' }}>
                {shop.address}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px' }}>Prep Lead Time:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      className="co-input"
                      style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }}
                      value={shop.customPrepMin}
                      onChange={(e) => handleUpdateShop(shop.id, { customPrepMin: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--co-cream-dim)' }}>mins</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px' }}>Active Dine-In Tables:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      className="co-input"
                      style={{ width: '80px', padding: '6px 10px', textAlign: 'center' }}
                      value={shop.tables}
                      onChange={(e) => handleUpdateShop(shop.id, { tables: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--co-cream-dim)' }}>tables</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--co-border)', paddingTop: '16px' }}>
              <button
                type="button"
                className={`btn-co ${shop.paused ? 'btn-co-green' : 'btn-co-danger'}`}
                style={{ flex: 1 }}
                onClick={() => handleUpdateShop(shop.id, { paused: !shop.paused })}
              >
                {shop.paused ? 'Resume Orders' : 'Pause Orders'}
              </button>

              <button
                type="button"
                className="btn-co btn-co-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setActiveQrShop(shop);
                  setSelectedTable('T-01');
                }}
              >
                Print Table QRs
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Printable QR Code Modal */}
      {activeQrShop && (
        <div className="co-drawer-overlay" onClick={() => setActiveQrShop(null)}>
          <div
            style={{
              background: 'var(--co-panel)',
              border: '1px solid var(--co-border-strong)',
              borderRadius: '14px',
              padding: '32px',
              width: '480px',
              maxWidth: '90%',
              margin: 'auto',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 800 }}>
              {activeQrShop.name}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--co-cream-dim)' }}>
              Printable table ordering QR stand kit
            </p>

            {/* Table picker */}
            <div style={{ marginBottom: '20px' }}>
              <select
                className="co-input"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                style={{ maxWidth: '200px', margin: '0 auto', textAlign: 'center' }}
              >
                {tables.map((t) => (
                  <option key={t} value={t}>
                    Table {t}
                  </option>
                ))}
              </select>
            </div>

            {/* QR Card Preview */}
            <div
              style={{
                background: '#FAF7F2',
                color: '#111',
                padding: '28px',
                borderRadius: '12px',
                display: 'inline-block',
                margin: '0 auto 24px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.14em', marginBottom: '8px' }}>
                BREWNS COFFEE
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#666', marginBottom: '16px' }}>
                SCAN TO ORDER &amp; CALL WAITER
              </div>

              <div
                dangerouslySetInnerHTML={{ __html: qrSvg }}
                style={{ display: 'flex', justifyContent: 'center' }}
              />

              <div style={{ marginTop: '16px', fontWeight: 800, fontSize: '22px', fontFamily: 'monospace' }}>
                {selectedTable}
              </div>
              <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>
                {activeQrShop.name}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn-co btn-co-secondary"
                style={{ flex: 1 }}
                onClick={() => setActiveQrShop(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-co btn-co-primary"
                style={{ flex: 1 }}
                onClick={() => window.print()}
              >
                Print Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
