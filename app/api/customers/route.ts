import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { can } from '@/lib/rbac';

export async function GET() {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'customers.view'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = getDb();
  const allOrders = Object.values(db.orders);

  // Group orders by phone or customer ID
  const customerList = Object.values(db.customers).map((c) => {
    const custOrders = allOrders.filter(
      (o) => o.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '')
    );
    const totalSpent = custOrders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.totals.total : 0), 0);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      stamps: c.stamps,
      orderCount: custOrders.length,
      totalSpent,
      lastOrder: custOrders[0]?.placed || null,
      savedAddresses: c.savedAddresses || [],
    };
  });

  // Also include customers who placed orders as guests
  const knownPhones = new Set(customerList.map((c) => c.phone.replace(/\D/g, '')));
  allOrders.forEach((o) => {
    const cleanPhone = o.phone.replace(/\D/g, '');
    if (!cleanPhone || knownPhones.has(cleanPhone)) return;
    knownPhones.add(cleanPhone);

    const custOrders = allOrders.filter((x) => x.phone.replace(/\D/g, '') === cleanPhone);
    const totalSpent = custOrders.reduce((sum, x) => sum + (x.status !== 'cancelled' ? x.totals.total : 0), 0);
    customerList.push({
      id: `guest_${cleanPhone}`,
      name: o.name,
      phone: o.phone,
      email: o.email || '',
      stamps: 0,
      orderCount: custOrders.length,
      totalSpent,
      lastOrder: custOrders[0]?.placed || null,
      savedAddresses: o.address ? [o.address] : [],
    });
  });

  customerList.sort((a, b) => (b.lastOrder || 0) - (a.lastOrder || 0));

  return NextResponse.json({ customers: customerList });
}
