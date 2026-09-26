import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { can } from '@/lib/rbac';
import { logAuditInternal } from '@/lib/server/orders';
import { LOCS, LOC_TITLES } from '@/lib/catalog';

export async function GET() {
  const db = getDb();
  const shops = Object.entries(db.shops).map(([key, setting]) => ({
    id: Number(key),
    name: LOC_TITLES[Number(key)] || LOCS[Number(key)]?.[0],
    address: LOCS[Number(key)]?.[1] || '',
    paused: setting.paused,
    customPrepMin: setting.customPrepMin,
    tables: setting.tables,
  }));

  return NextResponse.json({ shops });
}

export async function PATCH(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'shops.manage'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { shopId, paused, customPrepMin, tables } = await req.json();
    const id = Number(shopId);

    mutateDb((d) => {
      if (!d.shops[id]) {
        d.shops[id] = { shopId: id, paused: false, customPrepMin: 12, tables: 16 };
      }
      const shop = d.shops[id];
      if (paused !== undefined) shop.paused = !!paused;
      if (customPrepMin !== undefined) shop.customPrepMin = Math.max(5, Number(customPrepMin));
      if (tables !== undefined) shop.tables = Math.max(1, Math.min(100, Number(tables)));

      logAuditInternal(d, {
        actorId: staffCtx.user.id,
        actorName: staffCtx.user.name,
        role: staffCtx.user.role,
        action: 'shops.update',
        target: `Shop ${id} (${LOC_TITLES[id]})`,
        details: `Paused: ${shop.paused}, Prep: ${shop.customPrepMin}m, Tables: ${shop.tables}`,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Shop update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
