'use client';

import React, { useEffect, useState } from 'react';
import type { Order } from '@/lib/server/storage';
import { StatusPill } from './OrderBits';
import { LOC_TITLES } from '@/lib/catalog';

function playTicketChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignored
  }
}

export function KitchenScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stationFilter, setStationFilter] = useState<'all' | 'bar' | 'kitchen'>('all');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders?status=placed,accepted,preparing');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
      fetchOrders();
    }, 0);
    const interval = setInterval(() => {
      setNow(Date.now());
      fetchOrders();
    }, 4000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const toggleItemDone = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFireTicket = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      if (soundEnabled) playTicketChime();
      await fetchOrders();
    } catch {
      // Ignored
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ready' }),
      });
      if (soundEnabled) playTicketChime();
      await fetchOrders();
    } catch {
      // Ignored
    } finally {
      setActionLoadingId(null);
    }
  };

  // Station Counts
  const barCount = orders.filter((o) => o.items.some((it) => it.station === 'bar')).length;
  const kitchenCount = orders.filter((o) => o.items.some((it) => it.station === 'kitchen')).length;

  // Filter orders by station
  const stationOrders = orders.filter((o) => {
    if (stationFilter === 'all') return true;
    return o.items.some((it) => it.station === stationFilter);
  });

  return (
    <div>
      {/* Title & Station Filter Header */}
      <div className="co-page-title">
        <div>
          <h1>Kitchen Display System (KDS)</h1>
          <p>Real-time high-contrast station tickets for master baristas and line cooks.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Ticket sound alerts active' : 'Ticket sound muted'}
          >
            {soundEnabled ? '🔔 Sound ON' : '🔕 Muted'}
          </button>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--co-panel)', padding: '4px', borderRadius: '8px', border: '1px solid var(--co-border)' }}>
            <button
              type="button"
              className={`btn-co ${stationFilter === 'all' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px' }}
              onClick={() => setStationFilter('all')}
            >
              All Tickets ({orders.length})
            </button>
            <button
              type="button"
              className={`btn-co ${stationFilter === 'bar' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px' }}
              onClick={() => setStationFilter('bar')}
            >
              ☕ Espresso Bar ({barCount})
            </button>
            <button
              type="button"
              className={`btn-co ${stationFilter === 'kitchen' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px' }}
              onClick={() => setStationFilter('kitchen')}
            >
              🍳 Kitchen Line ({kitchenCount})
            </button>
          </div>
        </div>
      </div>

      {stationOrders.length === 0 ? (
        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
            background: 'var(--co-panel)',
            border: '1px dashed var(--co-border)',
            borderRadius: '16px',
            color: 'var(--co-cream-dim)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>☕</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--co-cream)', marginBottom: '4px' }}>
            ALL TICKETS COMPLETED
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            STATION SCREEN CLEAR · READY FOR NEW INCOMING DRINKS AND DISHES
          </div>
        </div>
      ) : (
        <div className="co-ticket-grid">
          {stationOrders.map((order) => {
            const visibleItems = stationFilter === 'all'
              ? order.items
              : order.items.filter((it) => it.station === stationFilter);

            const elapsedMins = now ? Math.floor((now - order.placed) / 60000) : 0;
            const isUrgent = elapsedMins >= 10;
            const isWarning = elapsedMins >= 6 && elapsedMins < 10;
            const isLoading = actionLoadingId === order.id;

            return (
              <div
                key={order.id}
                className="co-ticket"
                style={{
                  borderColor: isUrgent ? 'var(--co-red)' : isWarning ? 'var(--co-amber)' : undefined,
                  boxShadow: isUrgent ? '0 0 20px rgba(239, 68, 68, 0.25)' : undefined,
                }}
              >
                <div className="co-ticket-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '17px' }}>
                        {order.id}
                      </span>
                      <StatusPill status={order.status} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '3px' }}>
                      {order.type.toUpperCase()}{order.table ? ` · Table ${order.table}` : ''} · {LOC_TITLES[order.loc]} · {order.name}
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '13px',
                      color: isUrgent ? 'var(--co-red)' : isWarning ? 'var(--co-amber-light)' : 'var(--co-green)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {elapsedMins}M AGO
                  </div>
                </div>

                {order.note && (
                  <div
                    style={{
                      background: 'rgba(217, 138, 44, 0.12)',
                      borderBottom: '1px solid var(--co-border)',
                      padding: '9px 18px',
                      fontSize: '12px',
                      color: 'var(--co-amber-light)',
                      fontWeight: 600,
                    }}
                  >
                    ⚡ Special Instructions: {order.note}
                  </div>
                )}

                <div className="co-ticket-lines">
                  {visibleItems.map((item, idx) => {
                    const itemKey = `${order.id}-${idx}`;
                    const isDone = checkedItems[itemKey] || item.done;

                    return (
                      <div
                        key={idx}
                        className={`co-ticket-line ${isDone ? 'done' : ''}`}
                        onClick={() => toggleItemDone(itemKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={`co-check-box ${isDone ? 'checked' : ''}`}>
                          {isDone && <span style={{ color: '#000', fontSize: '11px', fontWeight: 800 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none' }}>
                            <span style={{ color: 'var(--co-amber-light)', marginRight: '8px', fontWeight: 800 }}>
                              {item.qty}×
                            </span>
                            {item.name}
                            <span style={{ marginLeft: '8px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--co-cream-faint)', textTransform: 'uppercase' }}>
                              [{item.station}]
                            </span>
                          </div>
                          {Object.keys(item.sel).length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '2px' }}>
                              {Object.entries(item.sel).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ padding: '12px 18px', background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--co-border)' }}>
                  {order.status === 'accepted' ? (
                    <button
                      type="button"
                      className="btn-co btn-co-primary"
                      style={{ width: '100%', padding: '10px' }}
                      onClick={() => handleFireTicket(order.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Firing...' : '🔥 Fire Ticket / Start Prep'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-co btn-co-green"
                      style={{ width: '100%', padding: '10px' }}
                      onClick={() => handleMarkReady(order.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Updating...' : 'Mark Station Ticket Ready ✓'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
