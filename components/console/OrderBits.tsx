'use client';

import React, { useState, useEffect } from 'react';
import type { Order } from '@/lib/server/storage';
import { STATUS_LABELS, STATUS_PILL_COLOR, ORDER_TYPE_LABELS, validNextActions, type OrderAction } from '@/lib/orderFlow';
import { money, LOCS, LOC_TITLES } from '@/lib/catalog';
import { can, canAny } from '@/lib/rbac';

export function StatusPill({ status }: { status: Order['status'] }) {
  const cfg = STATUS_PILL_COLOR[status] || { bg: '#222', text: '#fff', border: '#444' };
  const label = STATUS_LABELS[status] || status.toUpperCase();

  return (
    <span
      className="co-pill"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {label}
    </span>
  );
}

function useCurrentTime(intervalMs = 10000): number {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTime(Date.now());
    }, 0);
    const interval = setInterval(() => {
      setTime(Date.now());
    }, intervalMs);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [intervalMs]);
  return time;
}

export function OrderCard({
  order,
  onClick,
  onQuickAction,
  actionLoading,
}: {
  order: Order;
  onClick: () => void;
  onQuickAction?: (order: Order, action: OrderAction, e: React.MouseEvent) => void;
  actionLoading?: boolean;
}) {
  const now = useCurrentTime(10000);
  const typeLabel = ORDER_TYPE_LABELS[order.type] || order.type.toUpperCase();
  
  // Elapsed time calculation
  const elapsedMs = now ? Math.max(0, now - order.placed) : 0;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const isFulfilled = ['delivered', 'completed', 'cancelled'].includes(order.status);
  const isUrgent = !isFulfilled && elapsedMin >= 12;
  const isOverdue = now > 0 && now > order.target && !isFulfilled;

  let elapsedText = 'Just now';
  if (elapsedMin >= 60) {
    elapsedText = `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m ago`;
  } else if (elapsedMin >= 1) {
    elapsedText = `${elapsedMin}m ago`;
  }

  // Determine standard 1-click action
  let quickAction: { action: OrderAction; label: string; cls: string } | null = null;
  if (order.status === 'placed') {
    quickAction = { action: 'accept', label: 'Accept Order →', cls: 'btn-co-primary' };
  } else if (order.status === 'accepted') {
    quickAction = { action: 'ready', label: 'Mark Ready ✓', cls: 'btn-co-green' };
  } else if (order.status === 'preparing') {
    quickAction = { action: 'ready', label: 'Mark Ready ✓', cls: 'btn-co-green' };
  } else if (order.status === 'ready') {
    if (order.type === 'dinein') {
      quickAction = { action: 'serve', label: 'Serve Table 🍽️', cls: 'btn-co-green' };
    } else if (order.type === 'delivery') {
      quickAction = { action: 'dispatch', label: 'Dispatch 🛵', cls: 'btn-co-primary' };
    } else {
      quickAction = { action: 'complete', label: 'Complete Pickup ✓', cls: 'btn-co-primary' };
    }
  } else if (order.status === 'dispatched') {
    quickAction = { action: 'deliver', label: 'Confirm Delivered ✓', cls: 'btn-co-green' };
  } else if (order.status === 'served') {
    quickAction = { action: 'complete', label: 'Complete & Settle ✓', cls: 'btn-co-primary' };
  }

  const locShort = order.loc === 0 ? 'MM Alam' : order.loc === 1 ? 'CCA DHA' : 'Johar Town';

  return (
    <div
      className={`co-order-card ${isUrgent ? 'co-card-urgent' : ''}`}
      onClick={onClick}
      style={{
        borderColor: isUrgent ? 'rgba(239, 68, 68, 0.5)' : undefined,
        background: isUrgent ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.06) 0%, var(--co-card) 40%)' : undefined,
      }}
    >
      {/* Top Header */}
      <div className="co-card-top" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="co-order-num">{order.id}</span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '2px 5px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '4px',
              color: 'var(--co-cream-dim)',
            }}
          >
            {locShort}
          </span>
        </div>

        <span
          className="co-order-eta"
          style={{
            color: isOverdue ? 'var(--co-red)' : isUrgent ? 'var(--co-amber-light)' : 'var(--co-cream-dim)',
            fontWeight: isUrgent || isOverdue ? 700 : 500,
            fontSize: '11px',
          }}
        >
          {isOverdue ? '⚠️ OVERDUE' : isUrgent ? `⚠️ ${elapsedText}` : elapsedText}
        </span>
      </div>

      {/* Badges strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        <StatusPill status={order.status} />

        <span
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            padding: '2px 7px',
            background: order.type === 'dinein' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.06)',
            color: order.type === 'dinein' ? '#60A5FA' : 'var(--co-cream-dim)',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {order.type === 'dinein' ? `🍽️ Table ${order.table || '?'}` : order.type === 'delivery' ? '🛵 Delivery' : '🛍️ Takeaway'}
        </span>

        {/* Payment badge */}
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            padding: '2px 6px',
            borderRadius: '4px',
            background: order.paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: order.paid ? '#4ADE80' : '#FBBF24',
            fontWeight: 600,
          }}
        >
          {order.paid ? '✓ PAID' : '⚠️ CASH DUE'}
        </span>

        {/* Waiter assistance flag */}
        {order.waiterCall && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#F87171',
              fontWeight: 700,
              animation: 'pulseGreen 1.5s infinite',
            }}
          >
            🚨 WAITER CALLED
          </span>
        )}
      </div>

      {/* Customer Name */}
      <div className="co-card-cust" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>{order.name}</span>
        {order.phone && (
          <span style={{ fontSize: '11px', color: 'var(--co-cream-dim)', fontFamily: 'monospace' }}>
            {order.phone}
          </span>
        )}
      </div>

      {/* Items Preview */}
      <div className="co-card-items-preview">
        {order.items.map((it, idx) => (
          <span key={idx} style={{ display: 'inline-block', marginRight: '6px' }}>
            <strong style={{ color: 'var(--co-amber-light)' }}>{it.qty}×</strong> {it.name}
            {idx < order.items.length - 1 ? ',' : ''}
          </span>
        ))}
      </div>

      {/* Footer with Total and Quick 1-Click Action */}
      <div className="co-card-foot" style={{ marginTop: '10px', paddingTop: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
            {order.items.reduce((sum, it) => sum + it.qty, 0)} items
          </div>
          <div className="co-card-total">{money(order.totals.total)}</div>
        </div>

        {quickAction && onQuickAction && (
          <button
            type="button"
            className={`btn-co ${quickAction.cls}`}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
            }}
            disabled={actionLoading}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction(order, quickAction!.action, e);
            }}
          >
            {actionLoading ? 'Updating...' : quickAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function OrderDrawer({
  order,
  perms,
  role,
  onClose,
  onActionComplete,
}: {
  order: Order | null;
  perms: readonly string[];
  role: string;
  onClose: () => void;
  onActionComplete: () => void;
}) {
  const [chatInput, setChatInput] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!order) return null;

  const allowedActions = validNextActions(order.type, order.status, !!order.riderId);

  const handleAction = async (action: OrderAction) => {
    setLoadingAction(action);
    try {
      const res = await fetch(`/api/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        onActionComplete();
      }
    } catch {
      // Ignored
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      const res = await fetch(`/api/orders/${order.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatInput }),
      });
      if (res.ok) {
        setChatInput('');
        onActionComplete();
      }
    } catch {
      // Ignored
    }
  };

  return (
    <div className="co-drawer-overlay" onClick={onClose}>
      <div className="co-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="co-drawer-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{order.id}</h2>
              <StatusPill status={order.status} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--co-cream-dim)' }}>
              {LOC_TITLES[order.loc] || LOCS[order.loc]?.[0]} · {new Date(order.placed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            type="button"
            className="btn-co btn-co-secondary"
            style={{ padding: '6px 12px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="co-drawer-body">
          {/* Customer & Location Details */}
          <div style={{ background: 'var(--co-card)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>CUSTOMER</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{order.name}</p>
                <a href={`tel:${order.phone}`} style={{ fontSize: '12px', color: 'var(--co-amber-light)', textDecoration: 'none' }}>
                  {order.phone}
                </a>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>TYPE</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600 }}>
                  {ORDER_TYPE_LABELS[order.type]}
                  {order.table ? ` (${order.table})` : ''}
                </p>
              </div>
            </div>

            {order.address && (
              <div style={{ borderTop: '1px solid var(--co-border)', paddingTop: '8px', marginTop: '8px', fontSize: '12px' }}>
                <span style={{ color: 'var(--co-cream-dim)' }}>Address: </span>
                {order.address}
              </div>
            )}

            {order.note && (
              <div style={{ borderTop: '1px solid var(--co-border)', paddingTop: '8px', marginTop: '8px', fontSize: '12px', color: 'var(--co-amber-light)' }}>
                <strong>Note: </strong> {order.note}
              </div>
            )}
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', letterSpacing: '0.06em' }}>
              ORDER ITEMS ({order.items.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {order.items.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--co-card)',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--co-amber-light)', marginRight: '8px' }}>
                      {it.qty}×
                    </span>
                    <span>{it.name}</span>
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        padding: '1px 5px',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: '3px',
                        color: 'var(--co-cream-dim)',
                      }}
                    >
                      {it.station.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{money(it.unitPrice * it.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div
            style={{
              padding: '14px',
              background: 'var(--co-card)',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--co-cream-dim)' }}>Subtotal</span>
              <span>{money(order.totals.sub)}</span>
            </div>
            {order.totals.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: 'var(--co-green)' }}>
                <span>Discount ({order.promo || 'PROMO'})</span>
                <span>−{money(order.totals.discount)}</span>
              </div>
            )}
            {order.totals.fee > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--co-cream-dim)' }}>Delivery Fee</span>
                <span>{money(order.totals.fee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: 'var(--co-cream-dim)' }}>Punjab Sales Tax ({Math.round(order.totals.rate * 100)}%)</span>
              <span>{money(order.totals.tax)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '8px',
                marginTop: '8px',
                borderTop: '1px solid var(--co-border)',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              <span>Total</span>
              <span style={{ color: 'var(--co-amber-light)' }}>{money(order.totals.total)}</span>
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)' }}>ORDER CHAT</span>
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '8px',
                padding: '10px',
                background: 'var(--co-card)',
                borderRadius: '8px',
              }}
            >
              {order.messages.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--co-cream-dim)', textAlign: 'center' }}>
                  No messages yet
                </p>
              ) : (
                order.messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      fontSize: '12px',
                      alignSelf: m.sender === 'staff' ? 'flex-end' : 'flex-start',
                      background: m.sender === 'staff' ? 'var(--co-amber-dim)' : 'rgba(255,255,255,0.06)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      maxWidth: '85%',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: 'var(--co-cream-dim)', marginBottom: '2px' }}>
                      {m.name}
                    </div>
                    {m.text}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                className="co-input"
                placeholder="Reply to customer..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn-co btn-co-primary">
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="co-drawer-foot">
          {allowedActions.includes('accept') && (role === 'owner' || can(perms, 'orders.manage')) && (
            <button
              type="button"
              className="btn-co btn-co-primary"
              style={{ flex: 1 }}
              onClick={() => handleAction('accept')}
              disabled={loadingAction === 'accept'}
            >
              Accept Order
            </button>
          )}

          {allowedActions.includes('start') && (role === 'owner' || canAny(perms, 'orders.manage', 'kitchen.bar', 'kitchen.food')) && (
            <button
              type="button"
              className="btn-co btn-co-primary"
              style={{ flex: 1 }}
              onClick={() => handleAction('start')}
              disabled={loadingAction === 'start'}
            >
              Start Making
            </button>
          )}

          {allowedActions.includes('ready') && (role === 'owner' || canAny(perms, 'orders.manage', 'kitchen.bar', 'kitchen.food')) && (
            <button
              type="button"
              className="btn-co btn-co-green"
              style={{ flex: 1 }}
              onClick={() => handleAction('ready')}
              disabled={loadingAction === 'ready'}
            >
              Mark Ready
            </button>
          )}

          {allowedActions.includes('dispatch') && (role === 'owner' || canAny(perms, 'delivery.assign', 'delivery.ride')) && (
            <button
              type="button"
              className="btn-co btn-co-primary"
              style={{ flex: 1 }}
              onClick={() => handleAction('dispatch')}
              disabled={loadingAction === 'dispatch'}
            >
              Dispatch Delivery
            </button>
          )}

          {allowedActions.includes('deliver') && (role === 'owner' || canAny(perms, 'delivery.ride', 'orders.manage')) && (
            <button
              type="button"
              className="btn-co btn-co-green"
              style={{ flex: 1 }}
              onClick={() => handleAction('deliver')}
              disabled={loadingAction === 'deliver'}
            >
              Confirm Delivered
            </button>
          )}

          {allowedActions.includes('serve') && (role === 'owner' || canAny(perms, 'floor.tables', 'orders.manage')) && (
            <button
              type="button"
              className="btn-co btn-co-green"
              style={{ flex: 1 }}
              onClick={() => handleAction('serve')}
              disabled={loadingAction === 'serve'}
            >
              Serve to Table
            </button>
          )}

          {allowedActions.includes('complete') && (role === 'owner' || canAny(perms, 'orders.pay', 'orders.manage')) && (
            <button
              type="button"
              className="btn-co btn-co-primary"
              style={{ flex: 1 }}
              onClick={() => handleAction('complete')}
              disabled={loadingAction === 'complete'}
            >
              Complete &amp; Settle
            </button>
          )}

          {allowedActions.includes('cancel') && (role === 'owner' || can(perms, 'orders.manage')) && (
            <button
              type="button"
              className="btn-co btn-co-danger"
              onClick={() => handleAction('cancel')}
              disabled={loadingAction === 'cancel'}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
