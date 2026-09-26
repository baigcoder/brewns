import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { can } from '@/lib/rbac';
import { logAuditInternal } from '@/lib/server/orders';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ soldOut: db.soldOut || [] });
}

export async function POST(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'menu.availability'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { productId, soldOut } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID required.' }, { status: 400 });
    }

    mutateDb((d) => {
      if (!d.soldOut) d.soldOut = [];
      const isAlready = d.soldOut.includes(productId);

      if (soldOut && !isAlready) {
        d.soldOut.push(productId);
      } else if (!soldOut && isAlready) {
        d.soldOut = d.soldOut.filter((id) => id !== productId);
      }

      logAuditInternal(d, {
        actorId: staffCtx.user.id,
        actorName: staffCtx.user.name,
        role: staffCtx.user.role,
        action: soldOut ? 'menu.sold_out' : 'menu.available',
        target: productId,
        details: soldOut ? 'Marked sold out (86)' : 'Marked back in stock',
      });
    });

    return NextResponse.json({ ok: true, soldOut });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Availability update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
