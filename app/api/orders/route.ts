import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { createOrder, type CreateOrderInput } from '@/lib/server/orders';
import { canAny } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const shopParam = searchParams.get('shop');
  const statusParam = searchParams.get('status');
  const typeParam = searchParams.get('type');
  const search = searchParams.get('q')?.toLowerCase();

  const db = getDb();
  let ordersList = Object.values(db.orders);

  // Shop filter / scope
  if (staffCtx.user.role !== 'owner' && staffCtx.user.shops.length > 0) {
    ordersList = ordersList.filter((o) => staffCtx.user.shops.includes(o.loc));
  } else if (shopParam !== null && shopParam !== undefined && shopParam !== '') {
    ordersList = ordersList.filter((o) => o.loc === Number(shopParam));
  }

  // Status filter
  if (statusParam) {
    const statuses = statusParam.split(',');
    ordersList = ordersList.filter((o) => statuses.includes(o.status));
  }

  // Type filter
  if (typeParam) {
    ordersList = ordersList.filter((o) => o.type === typeParam);
  }

  // Search filter
  if (search) {
    ordersList = ordersList.filter(
      (o) =>
        o.id.toLowerCase().includes(search) ||
        o.name.toLowerCase().includes(search) ||
        o.phone.includes(search) ||
        (o.table && o.table.toLowerCase().includes(search))
    );
  }

  // Sort by placed descending
  ordersList.sort((a, b) => b.placed - a.placed);

  return NextResponse.json({ orders: ordersList });
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateOrderInput = await req.json();
    const staffCtx = await getCurrentStaff();

    const isStaff = !!staffCtx && canAny(staffCtx.perms, 'orders.create');
    const actor = isStaff
      ? { id: staffCtx.user.id, name: staffCtx.user.name, role: staffCtx.user.role }
      : undefined;

    const result = createOrder(
      {
        ...body,
        isStaffPos: isStaff && body.isStaffPos === true,
      },
      actor
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ order: result.order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && staffCtx.user.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized. Only owner or manager can clear orders.' }, { status: 403 });
  }

  mutateDb((d) => {
    d.orders = {};
    d.waiterCalls = {};
    d.orderSeq = 0;
  });

  return NextResponse.json({ ok: true, message: 'All orders cleared successfully.' });
}
