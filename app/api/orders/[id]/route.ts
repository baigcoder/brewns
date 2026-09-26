import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const staffCtx = await getCurrentStaff();
  if (!staffCtx) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = getDb();
  const order = db.orders[id];
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (
    staffCtx.user.role !== 'owner' &&
    staffCtx.user.shops.length > 0 &&
    !staffCtx.user.shops.includes(order.loc)
  ) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ order });
}
