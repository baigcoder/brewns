import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb, type PromoCode } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { can } from '@/lib/rbac';
import { logAuditInternal } from '@/lib/server/orders';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validateCode = searchParams.get('code')?.toUpperCase();

  const db = getDb();

  // If customer is validating a promo code at checkout
  if (validateCode) {
    const promo = db.promos[validateCode];
    if (promo && promo.active) {
      return NextResponse.json({ valid: true, discountPercent: promo.discountPercent, code: promo.code });
    }
    return NextResponse.json({ valid: false, error: 'Invalid or inactive promo code.' });
  }

  // Staff listing promos
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'menu.promos'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  return NextResponse.json({ promos: Object.values(db.promos) });
}

export async function POST(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'menu.promos'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { code, discountPercent, active, minSubtotal } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Promo code required.' }, { status: 400 });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const promo: PromoCode = {
      code: cleanCode,
      discountPercent: Number(discountPercent || 10),
      active: active !== false,
      minSubtotal: Number(minSubtotal || 0),
    };

    mutateDb((d) => {
      d.promos[cleanCode] = promo;

      logAuditInternal(d, {
        actorId: staffCtx.user.id,
        actorName: staffCtx.user.name,
        role: staffCtx.user.role,
        action: 'promo.save',
        target: cleanCode,
        details: `${promo.discountPercent}% off · ${promo.active ? 'Active' : 'Inactive'}`,
      });
    });

    return NextResponse.json({ promo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Promo save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
