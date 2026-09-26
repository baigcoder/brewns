'use client';

import React, { useEffect, useState } from 'react';
import type { Order, WaiterCall } from '@/lib/server/storage';
import { money } from '@/lib/catalog';
import Link from 'next/link';

type TableSection = 'all' | 'window' | 'hall' | 'patio';

export function FloorScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<TableSection>('all');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersRes, callsRes] = await Promise.all([
        fetch('/api/orders?type=dinein'),
        fetch('/api/floor/calls'),
      ]);
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders || []);
      }
      if (callsRes.ok) {
        const cData = await callsRes.json();
        setCalls(cData.calls || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    const interval = setInterval(fetchData, 4000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleResolveCall = async (callId: string) => {
    setActionLoading(true);
    try {
      await fetch('/api/floor/calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: callId }),
      });
      await fetchData();
    } catch {
      // Ignored
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (orderId: string, action: string) => {
    setActionLoading(true);
    try {
      await fetch(`/api/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchData();
    } catch {
      // Ignored
    } finally {
      setActionLoading(false);
    }
  };

  // Generate 16 tables
  const allTables = Array.from({ length: 16 }, (_, i) => {
    const num = i + 1;
    const id = `T-${String(num).padStart(2, '0')}`;
    let section: 'window' | 'hall' | 'patio' = 'hall';
    let seats = 4;
    let label = 'Dining Table';

    if (num <= 4) {
      section = 'window';
      seats = 2;
      label = 'Window Nook';
    } else if (num >= 13) {
      section = 'patio';
      seats = 4;
      label = 'Patio Table';
    } else if (num === 7 || num === 8) {
      seats = 6;
      label = 'Executive Booth';
    }

    return { id, num, section, seats, label };
  });

  const filteredTables = allTables.filter((t) => {
    if (sectionFilter === 'all') return true;
    return t.section === sectionFilter;
  });

  // Calculate stats
  const activeDineInOrders = orders.filter((o) =>
    ['placed', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
  );
  const occupiedCount = new Set(activeDineInOrders.map((o) => o.table)).size;
  const vacantCount = 16 - occupiedCount;
  const readyToServeCount = activeDineInOrders.filter((o) => o.status === 'ready').length;
  const activeCallsCount = calls.filter((c) => c.status === 'active').length;

  return (
    <div>
      {/* Title Header */}
      <div className="co-page-title">
        <div>
          <h1>Floor Map &amp; Table Service</h1>
          <p>Interactive 16-table dining layout, guest call signals, and bill settlements.</p>
        </div>

        <Link href="/dashboard/new" className="btn-co btn-co-primary" style={{ textDecoration: 'none' }}>
          + New Walk-in / Table Order
        </Link>
      </div>

      {/* KPI Stats Suite */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div className="co-kpi-card">
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
            TABLES OCCUPIED
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--co-amber-light)' }}>
            {occupiedCount} <span style={{ fontSize: '13px', color: 'var(--co-cream-dim)' }}>/ 16</span>
          </div>
        </div>

        <div className="co-kpi-card">
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
            TABLES AVAILABLE
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--co-green)' }}>
            {vacantCount}
          </div>
        </div>

        <div className="co-kpi-card">
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
            READY TO SERVE
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: readyToServeCount > 0 ? '#60A5FA' : 'var(--co-cream)' }}>
            {readyToServeCount}
          </div>
        </div>

        <div className="co-kpi-card">
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
            ACTIVE GUEST CALLS
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: activeCallsCount > 0 ? 'var(--co-red)' : 'var(--co-cream)' }}>
            {activeCallsCount}
          </div>
        </div>
      </div>

      {/* Active Waiter Calls Alert Strip */}
      {calls.length > 0 && (
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {calls.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--co-red)',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>🔔</span>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: '#fff' }}>
                    TABLE {c.table}
                  </span>
                  <span style={{ marginLeft: '10px', color: 'var(--co-cream)', fontSize: '13px' }}>
                    Guest requested <strong>{c.type.toUpperCase()}</strong> assistance
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-co btn-co-primary"
                onClick={() => handleResolveCall(c.id)}
                disabled={actionLoading}
              >
                Resolve &amp; Clear Call
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Section Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          ['all', 'All Dining Areas (16)'],
          ['window', 'Window Lounges (T-01 to T-04)'],
          ['hall', 'Main Roastery Hall (T-05 to T-12)'],
          ['patio', 'Courtyard Patio (T-13 to T-16)'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn-co ${sectionFilter === key ? 'btn-co-primary' : 'btn-co-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '11px' }}
            onClick={() => setSectionFilter(key as TableSection)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Interactive Table Map Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {filteredTables.map((t) => {
          const tableOrders = orders.filter(
            (o) => o.table === t.id && ['placed', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
          );
          const activeOrder = tableOrders[0];
          const hasCall = calls.some((c) => c.table === t.id && c.status === 'active');
          const isReadyToServe = activeOrder?.status === 'ready';
          const isSelected = selectedTable === t.id;

          let borderColor = 'var(--co-border)';
          let bg = 'linear-gradient(180deg, #181412 0%, #110E0D 100%)';
          let statusText = '🟢 VACANT';
          let statusColor = 'var(--co-green)';

          if (hasCall) {
            borderColor = 'var(--co-red)';
            bg = 'rgba(239, 68, 68, 0.15)';
            statusText = '🔔 GUEST CALL';
            statusColor = 'var(--co-red)';
          } else if (isReadyToServe) {
            borderColor = '#60A5FA';
            bg = 'rgba(59, 130, 246, 0.15)';
            statusText = '🍽️ READY TO SERVE';
            statusColor = '#60A5FA';
          } else if (activeOrder?.status === 'served') {
            borderColor = 'var(--co-amber)';
            bg = 'rgba(217, 138, 44, 0.1)';
            statusText = '💳 SEATED (BILL OPEN)';
            statusColor = 'var(--co-amber-light)';
          } else if (activeOrder) {
            borderColor = 'rgba(245, 158, 11, 0.4)';
            bg = 'rgba(245, 158, 11, 0.08)';
            statusText = '⏳ PREPARING';
            statusColor = '#FB923C';
          }

          if (isSelected) {
            borderColor = 'var(--co-amber-light)';
          }

          return (
            <div
              key={t.id}
              style={{
                background: bg,
                border: `1.5px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 0 20px rgba(217, 138, 44, 0.2)' : '0 4px 12px rgba(0,0,0,0.3)',
              }}
              onClick={() => setSelectedTable(t.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '16px', color: 'var(--co-cream)' }}>
                  {t.id}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--co-cream-dim)' }}>
                  {t.seats} Seats · {t.label}
                </span>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 700, color: statusColor, marginBottom: '6px' }}>
                {statusText}
              </div>

              {activeOrder ? (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--co-cream)' }}>
                    {activeOrder.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--co-amber-light)', fontWeight: 700, marginTop: '2px' }}>
                    {money(activeOrder.totals.total)} · {activeOrder.items.length} item(s)
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--co-cream-faint)', marginTop: '4px' }}>
                  Tap to view or seat guests
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Table Inspection & Action Drawer */}
      {selectedTable && (
        <div
          style={{
            marginTop: '32px',
            background: 'var(--co-panel)',
            border: '1px solid var(--co-border-strong)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Table {selectedTable} Service Console
              </h2>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
                {allTables.find((t) => t.id === selectedTable)?.label}
              </span>
            </div>
            <button
              type="button"
              className="btn-co btn-co-secondary"
              onClick={() => setSelectedTable(null)}
            >
              ✕ Close
            </button>
          </div>

          {(() => {
            const tableOrders = orders.filter(
              (o) => o.table === selectedTable && ['placed', 'accepted', 'preparing', 'ready', 'served'].includes(o.status)
            );

            if (tableOrders.length === 0) {
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <p style={{ color: 'var(--co-cream-dim)', margin: 0, fontSize: '13px' }}>
                    This table is currently vacant and clean. Guests can scan the table QR code to order, or you can take an order immediately.
                  </p>
                  <Link
                    href={`/dashboard/new?table=${selectedTable}`}
                    className="btn-co btn-co-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    Ring Up POS Order for Table {selectedTable} →
                  </Link>
                </div>
              );
            }

            const o = tableOrders[0];
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--co-border)', paddingBottom: '12px' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '16px' }}>{o.id}</span>
                    <span style={{ marginLeft: '12px', color: 'var(--co-cream)', fontSize: '14px', fontWeight: 600 }}>
                      Guest: {o.name}
                    </span>
                    <span style={{ marginLeft: '12px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>
                      STATUS: {o.status.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--co-amber-light)', fontSize: '18px' }}>
                    {money(o.totals.total)}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '4px' }}>
                    ORDER ITEMS &amp; STATION PROGRESS
                  </div>
                  {o.items.map((it, i) => (
                    <div key={i} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <strong style={{ color: 'var(--co-amber-light)' }}>{it.qty}×</strong> {it.name}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: it.done ? 'var(--co-green)' : 'var(--co-cream-dim)' }}>
                        {it.done ? '✓ READY' : 'PREPARING'}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {o.status === 'ready' && (
                    <button
                      type="button"
                      className="btn-co btn-co-green"
                      style={{ padding: '10px 18px', fontSize: '13px' }}
                      onClick={() => handleAction(o.id, 'serve')}
                      disabled={actionLoading}
                    >
                      🍽️ Serve Food to Table
                    </button>
                  )}

                  {o.status === 'served' && (
                    <button
                      type="button"
                      className="btn-co btn-co-primary"
                      style={{ padding: '10px 18px', fontSize: '13px' }}
                      onClick={() => handleAction(o.id, 'complete')}
                      disabled={actionLoading}
                    >
                      💳 Settle Bill &amp; Clear Table
                    </button>
                  )}

                  <Link
                    href={`/dashboard/new?table=${selectedTable}`}
                    className="btn-co btn-co-secondary"
                    style={{ textDecoration: 'none', padding: '10px 18px' }}
                  >
                    + Add More Items (Add-on Order)
                  </Link>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
