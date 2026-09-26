import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb, type WaiterCall } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { canAny } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const shopParam = searchParams.get('shop');

  const db = getDb();
  let calls = Object.values(db.waiterCalls).filter((c) => c.status === 'active');

  if (shopParam !== null && shopParam !== undefined && shopParam !== '') {
    calls = calls.filter((c) => c.shop === Number(shopParam));
  } else if (staffCtx.user.role !== 'owner' && staffCtx.user.shops.length > 0) {
    calls = calls.filter((c) => staffCtx.user.shops.includes(c.shop));
  }

  calls.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ calls });
}

export async function POST(req: NextRequest) {
  try {
    const { shop, table, type, orderId } = await req.json();
    if (table === undefined || table === null) {
      return NextResponse.json({ error: 'Table is required.' }, { status: 400 });
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const call: WaiterCall = {
      id: callId,
      shop: Number(shop || 0),
      table: String(table),
      type: type || 'assistance',
      status: 'active',
      createdAt: Date.now(),
    };

    mutateDb((d) => {
      d.waiterCalls[callId] = call;
      if (orderId && d.orders[orderId]) {
        d.orders[orderId].waiterCall = true;
      }
    });

    return NextResponse.json({ call });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Call creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || !canAny(staffCtx.perms, 'floor.tables', 'orders.manage')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Call ID required.' }, { status: 400 });
    }

    mutateDb((d) => {
      const call = d.waiterCalls[id];
      if (call) {
        call.status = 'resolved';
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Resolve failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
