'use client';

import { useId, useState } from 'react';
import { LOC_TITLES } from '@/lib/catalog';
import { money } from '@/lib/catalog';
import { pkDate, pkTime, rs } from './api';

export type ZReportData = {
  date: string;
  generatedAt: number;
  managerName: string;
  storeLoc: number | 'all';
  grossSales: number;
  discounts: number;
  netSales: number;
  tax16: number;
  tax5: number;
  totalTax: number;
  deliveryFees: number;
  grandTotal: number;
  tender: {
    cash: number;
    card: number;
    jazzcash: number;
    easypaisa: number;
    raast: number;
  };
  metrics: {
    orderCount: number;
    avgOrder: number;
    dineInCount: number;
    pickupCount: number;
    deliveryCount: number;
    cancelledCount: number;
    voidedAmount: number;
    onTimePct: number;
  };
};

export function ZReportModal({
  data,
  onClose,
}: {
  data: ZReportData;
  onClose: () => void;
}) {
  const [selectedLoc, setSelectedLoc] = useState<number | 'all'>(data.storeLoc);
  const locName = selectedLoc === 'all' ? 'Consolidated (All 3 Stores)' : LOC_TITLES[selectedLoc];
  const titleId = useId();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #brewns-zreport-print-sheet, #brewns-zreport-print-sheet * {
            visibility: visible;
          }
          #brewns-zreport-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .cx-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="brewns-zreport-print-sheet"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#141413',
          border: '1px solid #2e2e2a',
          borderRadius: '12px',
          padding: '28px',
          color: '#f5ede3',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          fontFamily: 'var(--font-space-mono), monospace',
          position: 'relative',
        }}
      >
        {/* Modal Controls */}
        <div
          className="cx-no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '1px solid #2e2e2a',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c99355' }}>
              {'// POS Financial Close'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#c99355',
                color: '#111',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🖨 Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                color: '#888',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Header Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 id={titleId} style={{ fontSize: '20px', letterSpacing: '0.15em', margin: '0 0 4px', textTransform: 'uppercase' }}>
            BREWNS COFFEE HOUSE
          </h2>
          <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#c99355', letterSpacing: '0.1em' }}>
            DAILY CLOSE AUDIT · Z-REPORT
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
            PRA REGISTRATION # 3491823-7 · STRN PK-LHR-4912
          </p>
        </div>

        {/* Audit Metadata */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed #333',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '11px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
          }}
        >
          <div>
            <span style={{ color: '#888' }}>BUSINESS DATE: </span>
            <b>{data.date}</b>
          </div>
          <div>
            <span style={{ color: '#888' }}>PRINT TIME: </span>
            <b>{pkTime(data.generatedAt)} PKT</b>
          </div>
          <div>
            <span style={{ color: '#888' }}>STORE: </span>
            <b>{locName}</b>
          </div>
          <div>
            <span style={{ color: '#888' }}>MANAGER: </span>
            <b>{data.managerName}</b>
          </div>
        </div>

        {/* Section 1: Sales Reconciliation */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#c99355',
              borderBottom: '1px solid #333',
              paddingBottom: '4px',
              marginBottom: '10px',
            }}
          >
            01. Revenue &amp; Sales Summary
          </div>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>Gross Item Sales</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{money(data.grossSales)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>Discounts &amp; Promos (BREWNS10 / Stamps)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', color: '#f87171' }}>-{money(data.discounts)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid #282828' }}>
                <td style={{ padding: '6px 0', color: '#fff', fontWeight: 600 }}>Net Product Sales</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{money(data.netSales)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>Punjab Sales Tax (Digital 5% PRA)</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tax5)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>Punjab Sales Tax (Standard 16% PRA)</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tax16)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>Delivery Fees Collected</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.deliveryFees)}</td>
              </tr>
              <tr style={{ borderTop: '1px double #555', borderBottom: '1px double #555' }}>
                <td style={{ padding: '8px 0', fontSize: '14px', fontWeight: 700, color: '#c99355' }}>
                  GRAND TOTAL AUDITED
                </td>
                <td style={{ padding: '8px 0', fontSize: '14px', fontWeight: 700, textAlign: 'right', color: '#c99355' }}>
                  {money(data.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Tender & Drawer Reconciliation */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#c99355',
              borderBottom: '1px solid #333',
              paddingBottom: '4px',
              marginBottom: '10px',
            }}
          >
            02. Tender &amp; Payment Method Breakdown
          </div>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>💵 Cash in Register Drawer</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tender.cash)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>💳 Credit / Debit POS Terminal Batch</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tender.card)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>🔴 JazzCash Direct Wallet Settlement</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tender.jazzcash)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>🟢 EasyPaisa Direct Wallet Settlement</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tender.easypaisa)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#bbb' }}>⚡ Raast Instant QR Payment Settlement</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{money(data.tender.raast)}</td>
              </tr>
              <tr style={{ borderTop: '1px solid #333' }}>
                <td style={{ padding: '6px 0', fontWeight: 600 }}>Total Reconciled Settlement</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                  {money(data.tender.cash + data.tender.card + data.tender.jazzcash + data.tender.easypaisa + data.tender.raast)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Operations & Fulfillment */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#c99355',
              borderBottom: '1px solid #333',
              paddingBottom: '4px',
              marginBottom: '10px',
            }}
          >
            03. Operational SLA &amp; Volume Metrics
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              fontSize: '11px',
            }}
          >
            <div style={{ background: '#1c1c1a', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#888', display: 'block', marginBottom: '2px' }}>Total Orders</span>
              <b style={{ fontSize: '15px' }}>{data.metrics.orderCount}</b>
            </div>
            <div style={{ background: '#1c1c1a', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#888', display: 'block', marginBottom: '2px' }}>Average Ticket</span>
              <b style={{ fontSize: '15px' }}>{money(data.metrics.avgOrder)}</b>
            </div>
            <div style={{ background: '#1c1c1a', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#888', display: 'block', marginBottom: '2px' }}>Dine-In / Pickup / Del</span>
              <b style={{ fontSize: '13px' }}>
                {data.metrics.dineInCount} / {data.metrics.pickupCount} / {data.metrics.deliveryCount}
              </b>
            </div>
            <div style={{ background: '#1c1c1a', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#888', display: 'block', marginBottom: '2px' }}>SLA On-Time &lt; 5m</span>
              <b style={{ fontSize: '15px', color: '#4ade80' }}>{data.metrics.onTimePct}%</b>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '40px',
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px dashed #444',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: '30px' }} />
            <div style={{ borderTop: '1px solid #555', paddingTop: '4px' }}>
              CASHIER / OPERATOR SIGNATURE
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: '30px' }} />
            <div style={{ borderTop: '1px solid #555', paddingTop: '4px' }}>
              SHIFT MANAGER AUDIT SIGNATURE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
