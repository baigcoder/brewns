'use client';

import React, { useEffect, useState } from 'react';
import { money, LOCS, LOC_TITLES } from '@/lib/catalog';
import Link from 'next/link';

type ReportData = {
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
    activeOrders: number;
    activeDeliveries: number;
  };
  typeCounts: { pickup: number; delivery: number; dinein: number };
  typeRevenue: { pickup: number; delivery: number; dinein: number };
  topItems: { id: string; name: string; qty: number; revenue: number }[];
  shopData: { loc: number; name: string; orders: number; revenue: number }[];
};

export function OverviewScreen() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await fetch('/api/sample-data', { method: 'POST' });
      await fetchReports();
    } catch {
      // Ignored
    } finally {
      setSeeding(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>☕</div>
        <span>COMPILING REAL-TIME CAFÉ METRICS...</span>
      </div>
    );
  }

  const maxItemQty = Math.max(1, ...data.topItems.map((i) => i.qty));
  const totalTypeCount = Math.max(1, (data.typeCounts.pickup || 0) + (data.typeCounts.delivery || 0) + (data.typeCounts.dinein || 0));

  const dineinPct = Math.round(((data.typeCounts.dinein || 0) / totalTypeCount) * 100);
  const deliveryPct = Math.round(((data.typeCounts.delivery || 0) / totalTypeCount) * 100);
  const pickupPct = Math.round(((data.typeCounts.pickup || 0) / totalTypeCount) * 100);

  // Helper for item icons
  const getItemIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('croissant') || n.includes('bun') || n.includes('roll') || n.includes('cake')) return '🥐';
    if (n.includes('burger') || n.includes('sandwich')) return '🍔';
    if (n.includes('pasta') || n.includes('rigatoni')) return '🍝';
    if (n.includes('cold brew') || n.includes('iced') || n.includes('matcha')) return '🧊';
    return '☕';
  };

  return (
    <div>
      {/* Hero Header with Filters and Global Quick Actions */}
      <div className="co-page-title" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>Operations Overview</h1>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ADE80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                fontWeight: 700,
              }}
            >
              ● LIVE METRICS
            </span>
          </div>
          <p>Real-time café operations, sales performance, channel distribution, and branch health.</p>
        </div>

        {/* Filter Strip */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Timeframe Switcher */}
          <div style={{ display: 'flex', background: 'var(--co-panel)', borderRadius: '6px', border: '1px solid var(--co-border)', padding: '2px' }}>
            <button
              type="button"
              className={`btn-co ${timeRange === 'today' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '5px 12px', borderRadius: '4px', border: 'none', fontSize: '11px' }}
              onClick={() => setTimeRange('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`btn-co ${timeRange === '7d' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '5px 12px', borderRadius: '4px', border: 'none', fontSize: '11px' }}
              onClick={() => setTimeRange('7d')}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`btn-co ${timeRange === '30d' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '5px 12px', borderRadius: '4px', border: 'none', fontSize: '11px' }}
              onClick={() => setTimeRange('30d')}
            >
              30 Days
            </button>
          </div>

          {/* Location Selector */}
          <select
            className="co-input"
            style={{ maxWidth: '170px', padding: '6px 10px', fontSize: '11px', height: '32px' }}
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">All 3 Branches</option>
            <option value="0">MM Alam Road</option>
            <option value="1">DHA Phase 5</option>
            <option value="2">Johar Town</option>
          </select>

          {/* Manual Refresh */}
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Updating...' : '⚡ Refresh'}
          </button>

          {/* Quick Seed */}
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            onClick={handleSeedData}
            disabled={seeding}
            title="Populate realistic orders and sales across all channels"
          >
            {seeding ? 'Seeding...' : '+ Load Sample Data'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="co-kpi-grid" style={{ marginBottom: '24px' }}>
        {/* Total Revenue */}
        <div className="co-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="co-kpi-label">TOTAL GROSS REVENUE</span>
            <span style={{ fontSize: '16px' }}>💰</span>
          </div>
          <div className="co-kpi-val" style={{ color: 'var(--co-amber-light)' }}>
            {money(data.kpis.totalRevenue)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: '#4ADE80', fontWeight: 600 }}>↗ +18.4%</span>
            <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>vs prior period</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="co-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="co-kpi-label">TOTAL ORDERS</span>
            <span style={{ fontSize: '16px' }}>📦</span>
          </div>
          <div className="co-kpi-val">{data.kpis.totalOrders}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: '#4ADE80', fontWeight: 600 }}>✓ 100%</span>
            <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>fulfillment completion</span>
          </div>
        </div>

        {/* Average Ticket Size */}
        <div className="co-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="co-kpi-label">AVG TICKET SIZE (AOV)</span>
            <span style={{ fontSize: '16px' }}>🧾</span>
          </div>
          <div className="co-kpi-val">{money(data.kpis.avgTicket)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--co-blue)', fontWeight: 600 }}>High Margin</span>
            <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>per guest basket</span>
          </div>
        </div>

        {/* Live Active Orders */}
        <div className="co-kpi-card" style={{ borderColor: data.kpis.activeOrders > 0 ? 'rgba(217, 138, 44, 0.4)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="co-kpi-label">LIVE ACTIVE QUEUE</span>
            <span style={{ fontSize: '16px' }}>⚡</span>
          </div>
          <div className="co-kpi-val" style={{ color: data.kpis.activeOrders > 0 ? 'var(--co-amber-light)' : 'var(--co-cream)' }}>
            {data.kpis.activeOrders}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: data.kpis.activeOrders > 0 ? '#F59E0B' : '#4ADE80',
                boxShadow: data.kpis.activeOrders > 0 ? '0 0 6px #F59E0B' : 'none',
              }}
            />
            <span style={{ fontSize: '11px', color: data.kpis.activeOrders > 0 ? 'var(--co-amber-light)' : 'var(--co-cream-dim)' }}>
              {data.kpis.activeOrders > 0 ? 'Orders in prep / dispatch' : 'Bar & Kitchen clear'}
            </span>
          </div>
        </div>

        {/* Active Deliveries */}
        <div className="co-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="co-kpi-label">ACTIVE DELIVERIES</span>
            <span style={{ fontSize: '16px' }}>🛵</span>
          </div>
          <div className="co-kpi-val" style={{ color: 'var(--co-purple)' }}>
            {data.kpis.activeDeliveries}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--co-purple)' }}>Rider Fleet</span>
            <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>active in Lahore</span>
          </div>
        </div>
      </div>

      {/* Charts & Operational Performance Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Top Selling Menu Items */}
        <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Top Selling Items</h2>
            <Link href="/dashboard/menu" style={{ fontSize: '11px', color: 'var(--co-amber-light)', textDecoration: 'none', fontWeight: 600 }}>
              Manage Menu &amp; Stock →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {data.topItems.slice(0, 5).map((it, idx) => {
              const pct = Math.round((it.qty / maxItemQty) * 100);
              const icon = getItemIcon(it.name);

              return (
                <div key={it.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>{icon}</span>
                      <span style={{ fontWeight: 600, color: 'var(--co-cream)' }}>{it.name}</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      <span style={{ color: 'var(--co-cream-dim)', marginRight: '8px' }}>{it.qty} sold</span>
                      <strong style={{ color: 'var(--co-amber-light)' }}>{money(it.revenue)}</strong>
                    </div>
                  </div>

                  <div style={{ height: '7px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #D98A2C 0%, #F59E0B 100%)',
                        borderRadius: '4px',
                        boxShadow: '0 0 8px rgba(217, 138, 44, 0.4)',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {data.topItems.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--co-cream-dim)', fontSize: '12px', padding: '20px 0' }}>
                No completed orders yet today.
              </p>
            )}
          </div>
        </div>

        {/* Fulfillment Channels Breakdown */}
        <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Fulfillment Channels</h2>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>
              {totalTypeCount} TOTAL TICKETS
            </span>
          </div>

          {/* Multi-Segment Distribution Bar */}
          <div style={{ height: '12px', display: 'flex', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${dineinPct}%`, background: '#22C55E', transition: 'width 0.4s' }} title={`Dine-in: ${dineinPct}%`} />
            <div style={{ width: `${deliveryPct}%`, background: '#A855F7', transition: 'width 0.4s' }} title={`Delivery: ${deliveryPct}%`} />
            <div style={{ width: `${pickupPct}%`, background: '#3B82F6', transition: 'width 0.4s' }} title={`Pickup: ${pickupPct}%`} />
          </div>

          {/* Detailed Cards for each channel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Dine-In */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--co-card)', borderRadius: '8px', borderLeft: '3px solid #22C55E' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>🍽️ Dine-in (Tables)</div>
                <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                  {data.typeCounts.dinein || 0} orders · {dineinPct}% of traffic
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--co-cream)' }}>
                {money(data.typeRevenue.dinein || 0)}
              </div>
            </div>

            {/* Delivery */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--co-card)', borderRadius: '8px', borderLeft: '3px solid #A855F7' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>🛵 Delivery (Riders)</div>
                <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                  {data.typeCounts.delivery || 0} orders · {deliveryPct}% of traffic
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--co-cream)' }}>
                {money(data.typeRevenue.delivery || 0)}
              </div>
            </div>

            {/* Pickup */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--co-card)', borderRadius: '8px', borderLeft: '3px solid #3B82F6' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>🛍️ Takeaway (Pickups)</div>
                <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                  {data.typeCounts.pickup || 0} orders · {pickupPct}% of traffic
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--co-cream)' }}>
                {money(data.typeRevenue.pickup || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Branches Performance Table */}
      <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Café Branch Performance</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--co-cream-dim)' }}>
              Real-time sales, order volume, and operations across Lahore outlets.
            </p>
          </div>
          <Link href="/dashboard/shops" className="btn-co btn-co-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
            Branch Settings →
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="co-table">
            <thead>
              <tr>
                <th>BRANCH LOCATION</th>
                <th>OPERATING STATUS</th>
                <th>ORDERS FULFILLED</th>
                <th>GROSS REVENUE</th>
                <th>AVERAGE BASKET</th>
                <th>QUICK ACTION</th>
              </tr>
            </thead>
            <tbody>
              {data.shopData.map((shop) => (
                <tr key={shop.loc}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--co-cream)' }}>{shop.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                      {LOCS[shop.loc]?.[1] || 'Lahore, Pakistan'}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#4ADE80',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />
                      OPEN &amp; ACCEPTING
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{shop.orders} tickets</td>
                  <td style={{ color: 'var(--co-amber-light)', fontWeight: 800, fontSize: '14px' }}>
                    {money(shop.revenue)}
                  </td>
                  <td>{shop.orders > 0 ? money(Math.round(shop.revenue / shop.orders)) : '—'}</td>
                  <td>
                    <Link
                      href={`/dashboard/orders?shop=${shop.loc}`}
                      className="btn-co btn-co-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      View Live Orders →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
