'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { Order } from '@/lib/server/storage';
import { OrderCard, OrderDrawer, StatusPill } from './OrderBits';
import { money, LOCS, LOC_TITLES } from '@/lib/catalog';
import type { OrderAction } from '@/lib/orderFlow';

function playBaristaChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playNote = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    // 3-note ascending cheerful chime: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz)
    playNote(659.25, 0.0, 0.35);
    playNote(830.61, 0.12, 0.35);
    playNote(987.77, 0.24, 0.55);
  } catch {
    // AudioContext blocked or unsupported
  }
}

export function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewTab, setViewTab] = useState<'board' | 'history'>('board');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState<string>('all');
  const [userPerms, setUserPerms] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  
  // Realtime & Audio State
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(true);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDoneRef = useRef(false);

  // Initialize chime preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('brewns_order_chime');
      if (saved !== null) {
        setChimeEnabled(saved === 'true');
      }
    } catch {
      // Ignored
    }
  }, []);

  const toggleChime = () => {
    const next = !chimeEnabled;
    setChimeEnabled(next);
    try {
      localStorage.setItem('brewns_order_chime', String(next));
    } catch {
      // Ignored
    }
    if (next) {
      playBaristaChime();
    }
  };

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const fetchOrders = useCallback(async () => {
    try {
      const q = search ? `&q=${encodeURIComponent(search)}` : '';
      const s = shopFilter !== 'all' ? `&shop=${shopFilter}` : '';
      const res = await fetch(`/api/orders?${q}${s}`);
      if (res.ok) {
        const data = await res.json();
        const incomingOrders: Order[] = data.orders || [];
        setOrders(incomingOrders);

        // Check for new incoming orders to chime
        const incomingIds = new Set(incomingOrders.map((o) => o.id));
        if (initialFetchDoneRef.current) {
          const brandNew = incomingOrders.filter(
            (o) => !prevOrderIdsRef.current.has(o.id) && o.status === 'placed'
          );
          if (brandNew.length > 0) {
            if (chimeEnabled) {
              playBaristaChime();
            }
            showTempNotice(`🔔 New incoming order: ${brandNew[0].id} (${brandNew[0].name})`);
          }
        } else {
          initialFetchDoneRef.current = true;
        }
        prevOrderIdsRef.current = incomingIds;

        // Keep drawer selected order synced
        if (selectedOrder) {
          const updated = incomingOrders.find((o) => o.id === selectedOrder.id);
          if (updated) setSelectedOrder(updated);
        }

        const now = new Date();
        setLastSynced(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch {
      // Offline / network glitch
    }
  }, [search, shopFilter, selectedOrder, chimeEnabled]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserPerms(data.perms || []);
        setUserRole(data.user?.role || '');
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchUser();
    fetchOrders();
    const interval = setInterval(fetchOrders, 2500); // 2.5s live polling
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Quick 1-click order action handler directly on cards
  const handleQuickAction = async (order: Order, action: OrderAction, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showTempNotice(`✓ Order ${order.id} updated to ${action.toUpperCase()}`);
        await fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update order');
      }
    } catch {
      alert('Network error while performing order action');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Simulate an authentic incoming live order
  const handleSimulateLiveOrder = async () => {
    setSimulating(true);
    try {
      const customers = [
        { name: 'Hamza Malik', phone: '0300 8471203', email: 'hamza.m@gmail.com' },
        { name: 'Ayesha Tariq', phone: '0321 4492100', email: 'ayesha.tariq@yahoo.com' },
        { name: 'Bilal Chaudhry', phone: '0333 5129031', email: 'bilal.ch@outlook.com' },
        { name: 'Zainab Raza', phone: '0345 9912044', email: 'zainab.raza@gmail.com' },
      ];
      const randomCust = customers[Math.floor(Math.random() * customers.length)];

      const sampleItemCombos = [
        [
          { id: 'latte', name: 'LATTE', qty: 2, unitPrice: 950, station: 'bar' as const },
          { id: 'cardamom-bun', name: 'CARDAMOM BUN', qty: 1, unitPrice: 750, station: 'kitchen' as const },
        ],
        [
          { id: 'cortado', name: 'CORTADO', qty: 1, unitPrice: 850, station: 'bar' as const },
          { id: 'cinnamon-roll', name: 'CINNAMON ROLL', qty: 1, unitPrice: 700, station: 'kitchen' as const },
        ],
        [
          { id: 'nitro-cold-brew', name: 'NITRO COLD BREW', qty: 1, unitPrice: 1100, station: 'bar' as const },
          { id: 'iced-latte', name: 'ICED LATTE', qty: 1, unitPrice: 1050, station: 'bar' as const },
        ],
      ];
      const items = sampleItemCombos[Math.floor(Math.random() * sampleItemCombos.length)];

      const sampleTypes: ('dinein' | 'pickup' | 'delivery')[] = ['dinein', 'pickup', 'delivery'];
      const chosenType = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
      const tableNum = chosenType === 'dinein' ? `Table ${Math.floor(Math.random() * 8) + 1}` : undefined;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: chosenType,
          loc: shopFilter !== 'all' ? parseInt(shopFilter, 10) : 0,
          area: chosenType === 'delivery' ? 0 : undefined,
          address: chosenType === 'delivery' ? 'House 42, Block L, Gulberg III, Lahore' : undefined,
          table: tableNum,
          name: randomCust.name,
          phone: randomCust.phone,
          email: randomCust.email,
          pay: Math.random() > 0.4 ? 1 : 0, // Card or Cash
          items: items.map((it) => ({
            id: it.id,
            name: it.name,
            qty: it.qty,
            unitPrice: it.unitPrice,
            station: it.station,
          })),
          note: Math.random() > 0.5 ? 'Extra hot oat milk please, thank you!' : '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showTempNotice(`🎉 Live order ${data.order?.id} simulated successfully!`);
        if (chimeEnabled) playBaristaChime();
        await fetchOrders();
      }
    } catch {
      alert('Error simulating order');
    } finally {
      setSimulating(false);
    }
  };

  // Reset/Wipe orders back to zero
  const handleWipeOrders = async () => {
    if (!confirm('Are you sure you want to wipe all orders from the active database? This resets the live board to 0.')) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch('/api/orders', { method: 'DELETE' });
      if (res.ok) {
        showTempNotice('✓ All orders wiped cleanly. Live board is at 0.');
        setSelectedOrder(null);
        await fetchOrders();
      }
    } catch {
      alert('Error clearing orders');
    } finally {
      setClearing(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Order ID', 'Date', 'Type', 'Table', 'Shop', 'Customer', 'Phone', 'Status', 'Total', 'Payment'];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.placed).toISOString(),
      o.type,
      o.table || 'N/A',
      LOC_TITLES[o.loc] || o.loc,
      `"${o.name}"`,
      o.phone,
      o.status,
      o.totals.total,
      o.paid ? 'PAID' : 'DUE',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `brewns_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPI Metrics Calculation
  const activeOrders = orders.filter((o) => !['delivered', 'completed', 'cancelled'].includes(o.status));
  const newOrders = orders.filter((o) => o.status === 'placed');
  const makingOrders = orders.filter((o) => o.status === 'accepted' || o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const outOrders = orders.filter((o) => o.status === 'dispatched' || o.status === 'served');
  const completedOrders = orders.filter((o) => o.status === 'completed' || o.status === 'delivered');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

  const todaySales = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totals.total, 0);

  // Status-filtered orders for history or filtered board
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'new') return o.status === 'placed';
    if (statusFilter === 'making') return o.status === 'accepted' || o.status === 'preparing';
    if (statusFilter === 'ready') return o.status === 'ready';
    if (statusFilter === 'out') return o.status === 'dispatched' || o.status === 'served';
    if (statusFilter === 'completed') return o.status === 'completed' || o.status === 'delivered';
    if (statusFilter === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  return (
    <div>
      {/* Toast Notice Banner */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            background: 'var(--co-panel)',
            border: '1px solid var(--co-amber-light)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            color: 'var(--co-cream)',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>{notice}</span>
        </div>
      )}

      {/* Page Title & Realtime Live Status Header */}
      <div className="co-page-title" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>Live Orders</h1>
            {/* Live Polling Pulse Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#4ADE80',
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#22C55E',
                  boxShadow: '0 0 8px #22C55E',
                  animation: 'pulseGreen 2s infinite',
                }}
              />
              LIVE REALTIME {lastSynced ? `· ${lastSynced}` : ''}
            </div>
          </div>
          <p>Zero mock data. Real-time fulfillment pipeline across Barista Station, Kitchen, Waitstaff &amp; Riders.</p>
        </div>

        {/* Header Right Action Group */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Audio Chime Toggle */}
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderColor: chimeEnabled ? 'rgba(245, 158, 11, 0.4)' : undefined,
              color: chimeEnabled ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
            }}
            onClick={toggleChime}
            title="Toggle audible chime when a new customer order arrives"
          >
            {chimeEnabled ? '🔔 Chime: ON' : '🔕 Chime: OFF'}
          </button>

          {/* Simulate Live Order Button */}
          <button
            type="button"
            className="btn-co btn-co-primary"
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
            onClick={handleSimulateLiveOrder}
            disabled={simulating}
          >
            {simulating ? 'Placing Order...' : '+ Simulate Live Order'}
          </button>

          {/* Reset / Clear Data */}
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--co-red)' }}
            onClick={handleWipeOrders}
            disabled={clearing}
            title="Reset active orders back to 0"
          >
            {clearing ? 'Clearing...' : 'Wipe Board'}
          </button>

          {/* View Tab Switcher */}
          <div style={{ display: 'flex', background: 'var(--co-panel)', borderRadius: '6px', border: '1px solid var(--co-border)', padding: '2px' }}>
            <button
              type="button"
              className={`btn-co ${viewTab === 'board' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '6px 12px', borderRadius: '4px', border: 'none' }}
              onClick={() => setViewTab('board')}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`btn-co ${viewTab === 'history' ? 'btn-co-primary' : 'btn-co-secondary'}`}
              style={{ padding: '6px 12px', borderRadius: '4px', border: 'none' }}
              onClick={() => setViewTab('history')}
            >
              Table View
            </button>
          </div>

          <button type="button" className="btn-co btn-co-secondary" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="co-kpi-grid" style={{ marginBottom: '20px' }}>
        <div className="co-kpi-card">
          <div className="co-kpi-label">ACTIVE TICKETS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--co-cream)' }}>
            {activeOrders.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '4px' }}>
            Across all stations &amp; tables
          </div>
        </div>

        <div className="co-kpi-card">
          <div className="co-kpi-label">NEW TO ACCEPT</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: newOrders.length > 0 ? 'var(--co-amber-light)' : 'var(--co-cream)' }}>
            {newOrders.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '4px' }}>
            Awaiting manager confirmation
          </div>
        </div>

        <div className="co-kpi-card">
          <div className="co-kpi-label">IN PREPARATION</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--co-blue)' }}>
            {makingOrders.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '4px' }}>
            Espresso bar &amp; kitchen ovens
          </div>
        </div>

        <div className="co-kpi-card">
          <div className="co-kpi-label">LIVE REVENUE TODAY</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--co-amber-light)' }}>
            {money(todaySales)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginTop: '4px' }}>
            From {orders.filter((o) => o.status !== 'cancelled').length} orders
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="co-input"
          placeholder="Search by order ID, customer name, phone, table..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '340px' }}
        />

        <select
          className="co-input"
          value={shopFilter}
          onChange={(e) => setShopFilter(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="all">All Locations</option>
          <option value="0">MM Alam Road</option>
          <option value="1">CCA, DHA Phase 5</option>
          <option value="2">Main Boulevard, Johar Town</option>
        </select>

        {/* Status Tab Filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          {[
            { id: 'all', label: 'ALL', count: orders.length },
            { id: 'new', label: 'NEW', count: newOrders.length },
            { id: 'making', label: 'MAKING', count: makingOrders.length },
            { id: 'ready', label: 'READY', count: readyOrders.length },
            { id: 'out', label: 'OUT / SERVED', count: outOrders.length },
            { id: 'completed', label: 'COMPLETED', count: completedOrders.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                background: statusFilter === tab.id ? 'var(--co-panel)' : 'transparent',
                border: `1px solid ${statusFilter === tab.id ? 'var(--co-amber)' : 'var(--co-border)'}`,
                color: statusFilter === tab.id ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      {viewTab === 'board' ? (
        <div className="co-board">
          {/* Column 1: New */}
          <div className="co-col">
            <div className="co-col-header">
              <div className="co-col-title" style={{ color: 'var(--co-amber-light)' }}>
                <span>⚡ NEW ORDERS</span>
                <span className="co-col-count">{newOrders.length}</span>
              </div>
            </div>
            <div className="co-cards-list">
              {newOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onClick={() => setSelectedOrder(o)}
                  onQuickAction={handleQuickAction}
                  actionLoading={actionLoadingId === o.id}
                />
              ))}
              {newOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--co-cream-dim)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>☕</div>
                  <p style={{ margin: 0, fontSize: '12px' }}>No new pending orders</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.6 }}>Incoming customer orders will appear here live</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Making */}
          <div className="co-col">
            <div className="co-col-header">
              <div className="co-col-title" style={{ color: 'var(--co-blue)' }}>
                <span>⏳ PREPARING</span>
                <span className="co-col-count">{makingOrders.length}</span>
              </div>
            </div>
            <div className="co-cards-list">
              {makingOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onClick={() => setSelectedOrder(o)}
                  onQuickAction={handleQuickAction}
                  actionLoading={actionLoadingId === o.id}
                />
              ))}
              {makingOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--co-cream-dim)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>🍳</div>
                  <p style={{ margin: 0, fontSize: '12px' }}>Kitchen &amp; Bar clear</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Ready */}
          <div className="co-col">
            <div className="co-col-header">
              <div className="co-col-title" style={{ color: 'var(--co-green)' }}>
                <span>✓ READY FOR SERVICE</span>
                <span className="co-col-count">{readyOrders.length}</span>
              </div>
            </div>
            <div className="co-cards-list">
              {readyOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onClick={() => setSelectedOrder(o)}
                  onQuickAction={handleQuickAction}
                  actionLoading={actionLoadingId === o.id}
                />
              ))}
              {readyOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--co-cream-dim)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>🛎️</div>
                  <p style={{ margin: 0, fontSize: '12px' }}>No orders waiting at counter</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 4: Out for delivery / Served */}
          <div className="co-col">
            <div className="co-col-header">
              <div className="co-col-title" style={{ color: 'var(--co-purple)' }}>
                <span>🛵 OUT / SERVED</span>
                <span className="co-col-count">{outOrders.length}</span>
              </div>
            </div>
            <div className="co-cards-list">
              {outOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onClick={() => setSelectedOrder(o)}
                  onQuickAction={handleQuickAction}
                  actionLoading={actionLoadingId === o.id}
                />
              ))}
              {outOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--co-cream-dim)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>🚴</div>
                  <p style={{ margin: 0, fontSize: '12px' }}>No active runs or seated tables</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* History & Detailed Tabular View */
        <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', overflow: 'hidden' }}>
          <table className="co-table">
            <thead>
              <tr>
                <th>ORDER ID</th>
                <th>TIME</th>
                <th>TYPE</th>
                <th>LOCATION</th>
                <th>CUSTOMER</th>
                <th>ITEMS</th>
                <th>STATUS</th>
                <th>PAYMENT</th>
                <th>TOTAL</th>
                <th>QUICK ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.id}</td>
                  <td style={{ color: 'var(--co-cream-dim)', fontSize: '12px' }}>
                    {new Date(o.placed).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '11px' }}>
                    {o.type}
                    {o.table ? ` (${o.table})` : ''}
                  </td>
                  <td>{LOC_TITLES[o.loc] || LOCS[o.loc]?.[0]}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>{o.phone}</div>
                  </td>
                  <td style={{ fontSize: '12px', maxWidth: '240px' }}>
                    {o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}
                  </td>
                  <td>
                    <StatusPill status={o.status} />
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: o.paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: o.paid ? '#4ADE80' : '#FBBF24',
                        fontWeight: 600,
                      }}
                    >
                      {o.paid ? 'PAID' : 'DUE'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--co-amber-light)' }}>
                    {money(o.totals.total)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {o.status === 'placed' && (
                      <button
                        type="button"
                        className="btn-co btn-co-primary"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        disabled={actionLoadingId === o.id}
                        onClick={(e) => handleQuickAction(o, 'accept', e)}
                      >
                        Accept
                      </button>
                    )}
                    {o.status === 'accepted' && (
                      <button
                        type="button"
                        className="btn-co btn-co-green"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        disabled={actionLoadingId === o.id}
                        onClick={(e) => handleQuickAction(o, 'ready', e)}
                      >
                        Ready
                      </button>
                    )}
                    {o.status === 'ready' && (
                      <button
                        type="button"
                        className="btn-co btn-co-green"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        disabled={actionLoadingId === o.id}
                        onClick={(e) => handleQuickAction(o, o.type === 'dinein' ? 'serve' : o.type === 'delivery' ? 'dispatch' : 'complete', e)}
                      >
                        {o.type === 'dinein' ? 'Serve' : o.type === 'delivery' ? 'Dispatch' : 'Complete'}
                      </button>
                    )}
                    {['dispatched', 'served'].includes(o.status) && (
                      <button
                        type="button"
                        className="btn-co btn-co-primary"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                        disabled={actionLoadingId === o.id}
                        onClick={(e) => handleQuickAction(o, o.type === 'delivery' ? 'deliver' : 'complete', e)}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--co-cream-dim)' }}>
                    No orders match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer for Detailed Inspector & Chat */}
      <OrderDrawer
        order={selectedOrder}
        perms={userPerms}
        role={userRole}
        onClose={() => setSelectedOrder(null)}
        onActionComplete={fetchOrders}
      />
    </div>
  );
}
