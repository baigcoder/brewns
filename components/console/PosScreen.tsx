'use client';

import React, { useState } from 'react';
import { PRODUCTS, type Product, money, defaultSel, unitPrice, selLabel } from '@/lib/catalog';
import { useRouter } from 'next/navigation';

export function PosScreen() {
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [cartItems, setCartItems] = useState<{ product: Product; sel: Record<string, number>; qty: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tempSel, setTempSel] = useState<Record<string, number>>({});

  // Order meta
  const [orderType, setOrderType] = useState<'pickup' | 'dinein' | 'delivery'>('dinein');
  const [loc, setLoc] = useState<number>(0);
  const [tableName, setTableName] = useState<string>('T-01');
  const [custName, setCustName] = useState<string>('Counter Guest');
  const [custPhone, setCustPhone] = useState<string>('0300 1234567');
  const [custAddress, setCustAddress] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [placing, setPlacing] = useState(false);

  const categories = [
    { key: 'all', label: 'All Items' },
    { key: 'drinks', label: 'Coffee & Drinks' },
    { key: 'bakery', label: 'Bakery' },
    { key: 'kitchen', label: 'Kitchen & Burgers' },
    { key: 'coolers', label: 'Coolers & Teas' },
    { key: 'beans', label: 'Whole Beans' },
  ];

  const filteredProducts = PRODUCTS.filter((p) => {
    if (selectedCat === 'all') return true;
    return p.cat === selectedCat;
  });

  const handleOpenProduct = (p: Product) => {
    setSelectedProduct(p);
    setTempSel(defaultSel(p));
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    setCartItems((prev) => {
      const existing = prev.find(
        (it) => it.product.id === selectedProduct.id && JSON.stringify(it.sel) === JSON.stringify(tempSel)
      );
      if (existing) {
        return prev.map((it) => (it === existing ? { ...it, qty: it.qty + 1 } : it));
      }
      return [...prev, { product: selectedProduct, sel: tempSel, qty: 1 }];
    });
    setSelectedProduct(null);
  };

  const handleUpdateQty = (index: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it, i) => (i === index ? { ...it, qty: it.qty + delta } : it))
        .filter((it) => it.qty > 0)
    );
  };

  const subtotal = cartItems.reduce((acc, it) => acc + unitPrice(it.product, it.sel) * it.qty, 0);
  const discount = promoCode.toUpperCase() === 'BREWNS10' ? Math.round(subtotal * 0.1) : 0;
  const tax = Math.round((subtotal - discount) * 0.05); // 5% POS digital rate
  const total = subtotal - discount + tax;

  const handlePlacePosOrder = async () => {
    if (!cartItems.length) return;
    setPlacing(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map((it) => ({
            id: it.product.id,
            sel: it.sel,
            qty: it.qty,
          })),
          type: orderType,
          loc,
          table: orderType === 'dinein' ? tableName : null,
          name: custName,
          phone: custPhone,
          address: custAddress,
          pay: 1, // POS card/wallet
          promo: promoCode || null,
          isStaffPos: true,
        }),
      });

      if (res.ok) {
        setCartItems([]);
        router.push('/dashboard/orders');
      }
    } catch {
      // Ignored
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div>
      <div className="co-page-title">
        <div>
          <h1>Point of Sale (POS)</h1>
          <p>Quick ring-up for counter walk-ins, phone orders, and table dining.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
        {/* Left: Product Selector */}
        <div>
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`btn-co ${selectedCat === c.key ? 'btn-co-primary' : 'btn-co-secondary'}`}
                style={{ padding: '7px 16px', borderRadius: '20px' }}
                onClick={() => setSelectedCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Product cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'var(--co-panel)',
                  border: '1px solid var(--co-border)',
                  borderRadius: '10px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => handleOpenProduct(p)}
              >
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)', marginBottom: '12px' }}>
                  {p.station.toUpperCase()} · {p.cat}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--co-amber-light)', fontSize: '15px' }}>
                  {money(p.price)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Cart and Order Details */}
        <div
          style={{
            background: 'var(--co-panel)',
            border: '1px solid var(--co-border)',
            borderRadius: '12px',
            padding: '20px',
            position: 'sticky',
            top: '80px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px' }}>Current Ticket</h2>

          {/* Order Type Toggle */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {(['dinein', 'pickup', 'delivery'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn-co ${orderType === t ? 'btn-co-primary' : 'btn-co-secondary'}`}
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                onClick={() => setOrderType(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Meta inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {orderType === 'dinein' && (
              <input
                className="co-input"
                placeholder="Table (e.g. T-04)"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            )}
            <input
              className="co-input"
              placeholder="Guest Name"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
            />
            <input
              className="co-input"
              placeholder="Mobile Phone"
              value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)}
            />
            {orderType === 'delivery' && (
              <input
                className="co-input"
                placeholder="Delivery Address"
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
              />
            )}
          </div>

          {/* Cart items */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              borderTop: '1px solid var(--co-border)',
              borderBottom: '1px solid var(--co-border)',
              padding: '12px 0',
              marginBottom: '16px',
            }}
          >
            {cartItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--co-cream-dim)', fontSize: '12px', margin: '20px 0' }}>
                Tap items on the left to add to ticket
              </p>
            ) : (
              cartItems.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{it.product.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                      {selLabel(it.product, it.sel)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-co btn-co-secondary"
                      style={{ padding: '2px 8px' }}
                      onClick={() => handleUpdateQty(idx, -1)}
                    >
                      −
                    </button>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{it.qty}</span>
                    <button
                      type="button"
                      className="btn-co btn-co-secondary"
                      style={{ padding: '2px 8px' }}
                      onClick={() => handleUpdateQty(idx, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing sums */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--co-cream-dim)' }}>
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--co-green)' }}>
                <span>Discount</span>
                <span>−{money(discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--co-cream-dim)' }}>
              <span>Sales Tax (5%)</span>
              <span>{money(tax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px', marginTop: '6px', borderTop: '1px solid var(--co-border)', paddingTop: '6px' }}>
              <span>Total</span>
              <span style={{ color: 'var(--co-amber-light)' }}>{money(total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-co btn-co-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={!cartItems.length || placing}
            onClick={handlePlacePosOrder}
          >
            {placing ? 'Submitting...' : `Charge & Ring Up · ${money(total)}`}
          </button>
        </div>
      </div>

      {/* Product Customizer Modal */}
      {selectedProduct && (
        <div className="co-drawer-overlay" onClick={() => setSelectedProduct(null)}>
          <div
            style={{
              background: 'var(--co-panel)',
              border: '1px solid var(--co-border)',
              borderRadius: '12px',
              padding: '24px',
              width: '440px',
              maxWidth: '90%',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800 }}>
              {selectedProduct.name}
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--co-cream-dim)' }}>
              Select drink/meal options
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {selectedProduct.options.map((opt) => (
                <div key={opt.key}>
                  <label style={{ display: 'block', fontSize: '11px', fontFamily: 'monospace', color: 'var(--co-cream-dim)', marginBottom: '6px' }}>
                    {opt.label}
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {opt.choices.map(([label, delta], cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        className={`btn-co ${tempSel[opt.key] === cIdx ? 'btn-co-primary' : 'btn-co-secondary'}`}
                        style={{ padding: '6px 12px', fontSize: '11px' }}
                        onClick={() => setTempSel((s) => ({ ...s, [opt.key]: cIdx }))}
                      >
                        {label} {delta > 0 ? `(+${money(delta)})` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-co btn-co-secondary"
                style={{ flex: 1 }}
                onClick={() => setSelectedProduct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-co btn-co-primary"
                style={{ flex: 1 }}
                onClick={handleAddToCart}
              >
                Add · {money(unitPrice(selectedProduct, tempSel))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
