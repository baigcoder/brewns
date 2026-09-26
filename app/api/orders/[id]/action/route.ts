import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStaff } from '@/lib/server/auth';
import { executeStaffOrderAction } from '@/lib/server/orders';
import type { OrderAction } from '@/lib/orderFlow';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const staffCtx = await getCurrentStaff();
  if (!staffCtx) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { action, note, riderId } = await req.json();
    if (!action) {
      return NextResponse.json({ error: 'Action is required.' }, { status: 400 });
    }

    const result = executeStaffOrderAction({
      orderId: id,
      action: action as OrderAction,
      staff: staffCtx.user,
      note,
      riderId,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ order: result.order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
