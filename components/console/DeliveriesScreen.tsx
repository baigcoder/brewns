'use client';

import React, { useEffect, useState } from 'react';
import type { Order, StaffUser } from '@/lib/server/storage';
import { money, LOC_TITLES } from '@/lib/catalog';
import { StatusPill } from './OrderBits';

export function DeliveriesScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<StaffUser[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [riderPlate, setRiderPlate] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [ordersRes, staffRes, meRes] = await Promise.all([
        fetch('/api/orders?type=delivery'),
        fetch('/api/staff'),
        fetch('/api/auth/me'),
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders || []);
      }
      if (staffRes.ok) {
        const sData = await staffRes.json();
        const staffList: StaffUser[] = sData.staff || [];
        setRiders(staffList.filter((s) => s.role === 'rider' && s.active));
      }
      if (meRes.ok) {
        const meData = await meRes.json();
        setUserRole(meData.user?.role || '');
        setUserId(meData.user?.id || '');
        setRiderPlate(meData.user?.riderPlate || 'LEN-8492');
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

  const handleAssignRider = async (orderId: string, targetRiderId?: string) => {
    setActionLoadingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_rider', riderId: targetRiderId || userId }),
      });
      await fetchData();
    } catch {
      // Ignored
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAction = async (orderId: string, action: string) => {
    setActionLoadingId(orderId);
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
      setActionLoadingId(null);
    }
  };

  const isRiderOnly = userRole === 'rider';

  // Rider's active assigned runs
  const myRuns = orders.filter(
    (o) => o.riderId === userId && ['accepted', 'preparing', 'ready', 'dispatched'].includes(o.status)
  );

  // Rider's completed runs today
  const myCompletedToday = orders.filter(
    (o) => o.riderId === userId && (o.status === 'delivered' || o.status === 'completed')
  );
  const myTotalCodCollected = myCompletedToday.reduce((sum, o) => sum + (o.pay === 0 ? o.totals.total : 0), 0);

  // Open delivery orders available to be assigned or claimed
  const unassignedDeliveries = orders.filter(
    (o) => !o.riderId && ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)
  );

  // Fleet wide active deliveries
  const activeDeliveries = orders.filter(
    (o) => o.riderId && ['ready', 'dispatched'].includes(o.status)
  );

  return (
    <div>
      {/* Title & Fleet Shift Header */}
      <div className="co-page-title">
        <div>
          <h1>Delivery Dispatch &amp; Fleet Operations</h1>
          <p>
            {isRiderOnly
              ? `Rider Terminal · Vehicle Plate: ${riderPlate} · Active Shift`
              : 'Fleet routing, real-time rider assignments, and doorstep fulfillment across Lahore.'}
          </p>
        </div>

        {isRiderOnly && (
          <div
            style={{
              display: 'flex',
              gap: '16px',
              background: 'var(--co-panel)',
              border: '1px solid var(--co-border)',
              borderRadius: '10px',
              padding: '8px 18px',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>
                COMPLETED RUNS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--co-cream)' }}>
                {myCompletedToday.length}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--co-border)' }} />
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>
                COD COLLECTED
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--co-amber-light)' }}>
                {money(myTotalCodCollected)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIDER-SPECIFIC WORKSTATION */}
      {isRiderOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Active Assigned Runs */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                My Assigned Deliveries ({myRuns.length})
              </h2>
              {myRuns.length > 0 && (
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-amber-light)' }}>
                  ● ACTIVE RUN IN PROGRESS
                </span>
              )}
            </div>

            {myRuns.length === 0 ? (
              <div
                style={{
                  padding: '36px',
                  background: 'var(--co-panel)',
                  border: '1px dashed var(--co-border)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: 'var(--co-cream-dim)',
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛵</div>
                <div style={{ fontWeight: 600, color: 'var(--co-cream)', marginBottom: '4px' }}>
                  No active run assigned right now.
                </div>
                <div style={{ fontSize: '12px' }}>
                  Check the open delivery pool below to claim a run, or wait for the cashier/manager to dispatch to your bike.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                {myRuns.map((o) => {
                  const isLoading = actionLoadingId === o.id;
                  const isPreparing = o.status === 'preparing' || o.status === 'accepted';
                  const isReady = o.status === 'ready';
                  const isDispatched = o.status === 'dispatched';

                  return (
                    <div
                      key={o.id}
                      style={{
                        background: 'linear-gradient(180deg, #1A1513 0%, #120F0D 100%)',
                        border: isReady ? '1px solid var(--co-green)' : isDispatched ? '1px solid var(--co-purple)' : '1px solid var(--co-border-strong)',
                        borderRadius: '14px',
                        padding: '22px',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                      }}
                    >
                      {/* Status Progress Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '17px', color: 'var(--co-cream)' }}>
                            {o.id}
                          </span>
                          <StatusPill status={o.status} />
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--co-amber-light)', fontSize: '15px' }}>
                          {o.pay === 0 ? `COLLECT COD: ${money(o.totals.total)}` : 'PAID ONLINE (CARD)'}
                        </div>
                      </div>

                      {/* Station Phase Banner */}
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          marginBottom: '16px',
                          background: isPreparing
                            ? 'rgba(245, 158, 11, 0.12)'
                            : isReady
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(168, 85, 247, 0.15)',
                          color: isPreparing ? 'var(--co-amber-light)' : isReady ? 'var(--co-green)' : '#D8B4FE',
                          border: `1px solid ${isPreparing ? 'rgba(245, 158, 11, 0.3)' : isReady ? 'rgba(34, 197, 94, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>{isPreparing ? '⏳' : isReady ? '🟢' : '🛵'}</span>
                        <span>
                          {isPreparing && 'Kitchen / Barista is actively preparing this order. Stand by at shop.'}
                          {isReady && 'Order is packaged and ready at the counter! Collect bag & start riding.'}
                          {isDispatched && 'Order is dispatched and on the way to the customer doorstep.'}
                        </span>
                      </div>

                      {/* Customer Details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginBottom: '16px' }}>
                        <div>
                          <strong style={{ color: 'var(--co-cream-dim)' }}>Recipient:</strong>{' '}
                          <span style={{ fontWeight: 700 }}>{o.name}</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--co-cream-dim)' }}>Destination:</strong>{' '}
                          <span>{o.address}</span>
                        </div>
                        {o.note && (
                          <div
                            style={{
                              background: 'rgba(217, 138, 44, 0.1)',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              color: 'var(--co-amber-light)',
                              fontSize: '12px',
                            }}
                          >
                            <strong>Delivery Note:</strong> {o.note}
                          </div>
                        )}
                      </div>

                      {/* Navigation & Calling Suite */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <a
                          href={`tel:${o.phone}`}
                          className="btn-co btn-co-secondary"
                          style={{ flex: 1, textDecoration: 'none', padding: '9px 12px' }}
                        >
                          📞 Call Customer
                        </a>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(o.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-co btn-co-secondary"
                          style={{ flex: 1, textDecoration: 'none', padding: '9px 12px' }}
                        >
                          📍 Open Google Maps
                        </a>
                      </div>

                      {/* Order Action Trigger */}
                      <div>
                        {isReady && (
                          <button
                            type="button"
                            className="btn-co btn-co-primary"
                            style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                            onClick={() => handleAction(o.id, 'dispatch')}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Updating...' : 'Start Riding (Dispatch Order) 🛵'}
                          </button>
                        )}
                        {isDispatched && (
                          <button
                            type="button"
                            className="btn-co btn-co-green"
                            style={{ width: '100%', padding: '12px', fontSize: '13px' }}
                            onClick={() => handleAction(o.id, 'deliver')}
                            disabled={isLoading}
                          >
                            {isLoading ? 'Updating...' : 'Delivered & Handed Over ✓'}
                          </button>
                        )}
                        {isPreparing && (
                          <div
                            style={{
                              textAlign: 'center',
                              fontSize: '12px',
                              color: 'var(--co-cream-dim)',
                              fontFamily: 'monospace',
                              padding: '8px',
                            }}
                          >
                            WAITING FOR ROASTERY COUNTER HANDOVER...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Open Delivery Pool for Rider Claiming */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
              Open Delivery Pool · Available for Pickup ({unassignedDeliveries.length})
            </h2>

            {unassignedDeliveries.length === 0 ? (
              <div style={{ padding: '24px', background: 'var(--co-panel)', borderRadius: '10px', color: 'var(--co-cream-dim)', fontSize: '13px' }}>
                All delivery tickets currently have an assigned rider.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {unassignedDeliveries.map((o) => {
                  const isLoading = actionLoadingId === o.id;
                  return (
                    <div
                      key={o.id}
                      style={{
                        background: 'var(--co-card)',
                        border: '1px solid var(--co-border)',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{o.id}</span>
                          <span style={{ fontWeight: 700, color: 'var(--co-amber-light)' }}>
                            {money(o.totals.total)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{o.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--co-cream-dim)', marginBottom: '8px' }}>
                          📍 {o.address}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginBottom: '14px' }}>
                          Items: {o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-co btn-co-primary"
                        style={{ width: '100%', padding: '9px 14px' }}
                        onClick={() => handleAssignRider(o.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Claiming Run...' : '⚡ Accept & Assign to My Bike'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DISPATCHER & MANAGEMENT VIEW */}
      {!isRiderOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Active Fleet Overview */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
              Active Delivery Fleet ({riders.length} Registered Riders)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {riders.map((r) => {
                const activeRiderRuns = orders.filter(
                  (o) => o.riderId === r.id && ['ready', 'dispatched'].includes(o.status)
                );
                return (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--co-card)',
                      border: '1px solid var(--co-border)',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{r.name}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#06B6D4',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                        }}
                      >
                        {r.riderPlate || 'BIKE'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--co-cream-dim)', marginBottom: '8px' }}>
                      📞 {r.phone}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: activeRiderRuns.length > 0 ? 'var(--co-amber-light)' : 'var(--co-green)' }}>
                      {activeRiderRuns.length > 0 ? `🛵 ${activeRiderRuns.length} Active Run(s)` : '🟢 Available at Roastery'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unassigned Deliveries Queue */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
              Unassigned Deliveries Waiting for Dispatch ({unassignedDeliveries.length})
            </h2>

            {unassignedDeliveries.length === 0 ? (
              <div style={{ padding: '24px', background: 'var(--co-panel)', borderRadius: '10px', color: 'var(--co-cream-dim)' }}>
                All delivery orders currently have assigned fleet riders.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {unassignedDeliveries.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: 'var(--co-card)',
                      border: '1px solid var(--co-border)',
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{o.id}</span>
                      <StatusPill status={o.status} />
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{o.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--co-cream-dim)', marginBottom: '12px' }}>
                      📍 {o.address} · {LOC_TITLES[o.loc]}
                    </div>

                    <div style={{ marginTop: '14px', borderTop: '1px solid var(--co-border)', paddingTop: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '6px' }}>
                        ASSIGN TO RIDER:
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          className="co-input"
                          style={{ padding: '7px 10px', fontSize: '12px' }}
                          onChange={(e) => {
                            if (e.target.value) handleAssignRider(o.id, e.target.value);
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Select available rider...</option>
                          {riders.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} ({r.riderPlate || 'Bike'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Deliveries Across Lahore */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
              In-Transit Deliveries ({activeDeliveries.length})
            </h2>

            {activeDeliveries.length === 0 ? (
              <div style={{ padding: '24px', background: 'var(--co-panel)', borderRadius: '10px', color: 'var(--co-cream-dim)' }}>
                No active delivery runs currently out on the road.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                {activeDeliveries.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: 'var(--co-card)',
                      border: '1px solid var(--co-border)',
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{o.id}</span>
                      <StatusPill status={o.status} />
                    </div>

                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                      <strong>Rider: </strong> {o.riderName} ({o.riderPlate})
                    </div>
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                      <strong>Customer: </strong> {o.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--co-cream-dim)', marginBottom: '14px' }}>
                      📍 {o.address}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {o.status === 'ready' && (
                        <button
                          type="button"
                          className="btn-co btn-co-primary"
                          style={{ flex: 1, padding: '7px 10px' }}
                          onClick={() => handleAction(o.id, 'dispatch')}
                        >
                          Dispatch Order
                        </button>
                      )}
                      {o.status === 'dispatched' && (
                        <button
                          type="button"
                          className="btn-co btn-co-green"
                          style={{ flex: 1, padding: '7px 10px' }}
                          onClick={() => handleAction(o.id, 'deliver')}
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
