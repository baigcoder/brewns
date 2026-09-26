import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentStaff } from '@/lib/server/auth';
import { sectionByKey, canOpen, homeFor } from '@/lib/rbac';
import { OverviewScreen } from '@/components/console/OverviewScreen';
import { OrdersScreen } from '@/components/console/OrdersScreen';
import { PosScreen } from '@/components/console/PosScreen';
import { KitchenScreen } from '@/components/console/KitchenScreen';
import { FloorScreen } from '@/components/console/FloorScreen';
import { DeliveriesScreen } from '@/components/console/DeliveriesScreen';
import { MenuScreen } from '@/components/console/MenuScreen';
import { ShopsScreen } from '@/components/console/ShopsScreen';
import { TeamScreen } from '@/components/console/TeamScreen';
import { AccessScreen } from '@/components/console/AccessScreen';
import { CustomersScreen } from '@/components/console/CustomersScreen';
import { ActivityScreen } from '@/components/console/ActivityScreen';
import { AccountScreen } from '@/components/console/AccountScreen';

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  // Verify staff authentication
  const staffCtx = await getCurrentStaff();
  if (!staffCtx) {
    redirect('/signin');
  }

  // Verify section existence
  const sec = sectionByKey(section);
  if (!sec) {
    notFound();
  }

  // Server-side RBAC Permission Enforcement
  if (!canOpen(staffCtx.perms, sec)) {
    const homeUrl = homeFor(staffCtx.user.role, staffCtx.perms);
    return (
      <div
        style={{
          maxWidth: '600px',
          margin: '60px auto',
          padding: '36px 32px',
          background: 'var(--co-panel)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
          }}
        >
          🔒
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#F87171' }}>
          403 Access Denied
        </h2>
        <p style={{ color: 'var(--co-cream-dim)', fontSize: '13px', lineHeight: 1.6, margin: '0 0 24px' }}>
          Your signed-in account (<strong>{staffCtx.user.name}</strong> · <span style={{ textTransform: 'uppercase', fontFamily: 'monospace', color: 'var(--co-amber-light)' }}>{staffCtx.user.role}</span>) does not carry sufficient permissions to access the <strong>{sec.label}</strong> console.
        </p>

        <div
          style={{
            background: 'var(--co-card)',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '12px',
            border: '1px solid var(--co-border)',
          }}
        >
          <div style={{ color: 'var(--co-cream-dim)', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }}>
            REQUIRED ROLES / PERMISSIONS
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {sec.any.map((p) => (
              <span
                key={p}
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: 'var(--co-amber-light)',
                  fontWeight: 600,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={homeUrl} className="btn-co btn-co-primary">
            Return to My Authorized Console
          </Link>
          <Link href="/dashboard/account" className="btn-co btn-co-secondary">
            View My Permissions
          </Link>
        </div>
      </div>
    );
  }

  // Render authorized section component
  switch (section) {
    case 'overview':
      return <OverviewScreen />;
    case 'orders':
      return <OrdersScreen />;
    case 'new':
      return <PosScreen />;
    case 'kitchen':
      return <KitchenScreen />;
    case 'floor':
      return <FloorScreen />;
    case 'deliveries':
      return <DeliveriesScreen />;
    case 'menu':
      return <MenuScreen />;
    case 'shops':
      return <ShopsScreen />;
    case 'staff':
      return <TeamScreen />;
    case 'access':
      return <AccessScreen />;
    case 'customers':
      return <CustomersScreen />;
    case 'activity':
      return <ActivityScreen />;
    case 'account':
      return <AccountScreen />;
    default:
      notFound();
  }
}
