import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';

export async function GET() {
  const staffCtx = await getCurrentStaff();
  const db = getDb();

  const allOrders = Object.values(db.orders);
  const scopedOrders = staffCtx && staffCtx.user.role !== 'owner' && staffCtx.user.shops.length > 0
    ? allOrders.filter((o) => staffCtx.user.shops.includes(o.loc))
    : allOrders;

  const activeOrders = scopedOrders.filter((o) =>
    ['placed', 'accepted', 'preparing', 'ready', 'dispatched'].includes(o.status)
  ).length;

  const allCalls = Object.values(db.waiterCalls).filter((c) => c.status === 'active');
  const activeCalls = staffCtx && staffCtx.user.role !== 'owner' && staffCtx.user.shops.length > 0
    ? allCalls.filter((c) => staffCtx.user.shops.includes(c.shop)).length
    : allCalls.length;

  return NextResponse.json({
    version: db.version,
    activeOrders,
    activeCalls,
    timestamp: Date.now(),
  });
}
