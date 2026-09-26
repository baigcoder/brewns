import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { can } from '@/lib/rbac';
import { LOCS, LOC_TITLES } from '@/lib/catalog';

export async function GET() {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'reports.view'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = getDb();
  const allOrders = Object.values(db.orders);

  // Filter scoped to shops if not owner
  const orders = staffCtx.user.role === 'owner'
    ? allOrders
    : allOrders.filter((o) => staffCtx.user.shops.includes(o.loc));

  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = validOrders.reduce((acc, o) => acc + o.totals.total, 0);
  const totalOrders = validOrders.length;
  const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Breakdown by type
  const typeCounts = { pickup: 0, delivery: 0, dinein: 0 };
  const typeRevenue = { pickup: 0, delivery: 0, dinein: 0 };
  validOrders.forEach((o) => {
    typeCounts[o.type] = (typeCounts[o.type] || 0) + 1;
    typeRevenue[o.type] = (typeRevenue[o.type] || 0) + o.totals.total;
  });

  // Top items
  const itemMap: Record<string, { id: string; name: string; qty: number; revenue: number }> = {};
  validOrders.forEach((o) => {
    o.items.forEach((it) => {
      if (!itemMap[it.id]) {
        itemMap[it.id] = { id: it.id, name: it.name, qty: 0, revenue: 0 };
      }
      itemMap[it.id].qty += it.qty;
      itemMap[it.id].revenue += it.unitPrice * it.qty;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

  // Shop comparison
  const shopData = [0, 1, 2].map((locIndex) => {
    const shopOrders = validOrders.filter((o) => o.loc === locIndex);
    const rev = shopOrders.reduce((acc, o) => acc + o.totals.total, 0);
    return {
      loc: locIndex,
      name: LOC_TITLES[locIndex] || LOCS[locIndex]?.[0],
      orders: shopOrders.length,
      revenue: rev,
    };
  });

  // Live active counts
  const activeOrders = orders.filter((o) => ['placed', 'accepted', 'preparing', 'ready', 'dispatched'].includes(o.status)).length;
  const activeDeliveries = orders.filter((o) => ['dispatched', 'ready'].includes(o.status) && o.type === 'delivery').length;

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalOrders,
      avgTicket,
      activeOrders,
      activeDeliveries,
    },
    typeCounts,
    typeRevenue,
    topItems,
    shopData,
  });
}
