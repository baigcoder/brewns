'use client';

import React, { useEffect, useState } from 'react';
import { money } from '@/lib/catalog';

type CustomerItem = {
  id: string;
  name: string;
  phone: string;
  email: string;
  stamps: number;
  orderCount: number;
  totalSpent: number;
  lastOrder: number | null;
  savedAddresses: string[];
};

export function CustomersScreen() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="co-page-title">
        <div>
          <h1>Customers &amp; Loyalty Club</h1>
          <p>Customer accounts, order histories, and Brewns Club stamp balances.</p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          className="co-input"
          placeholder="Search customers by name, phone number, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table className="co-table">
          <thead>
            <tr>
              <th>CUSTOMER</th>
              <th>CONTACT</th>
              <th>CLUB STAMPS</th>
              <th>ORDERS</th>
              <th>LIFETIME SPENT</th>
              <th>LAST VISIT</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>
                    {c.savedAddresses[0] || 'No saved address'}
                  </div>
                </td>
                <td>
                  <div>{c.phone}</div>
                  <div style={{ fontSize: '11px', color: 'var(--co-cream-dim)' }}>{c.email || '—'}</div>
                </td>
                <td>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(217, 138, 44, 0.15)',
                      color: 'var(--co-amber-light)',
                    }}
                  >
                    ★ {c.stamps} STAMP{c.stamps === 1 ? '' : 'S'}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{c.orderCount}</td>
                <td style={{ fontWeight: 700, color: 'var(--co-amber-light)' }}>
                  {money(c.totalSpent)}
                </td>
                <td style={{ fontSize: '12px', color: 'var(--co-cream-dim)' }}>
                  {c.lastOrder ? new Date(c.lastOrder).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--co-cream-dim)', padding: '30px' }}>
                  No customer profiles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
