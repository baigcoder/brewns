import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { normaliseRolePerms, type RolePerms } from '@/lib/rbac';
import { logAuditInternal } from '@/lib/server/orders';

export async function GET() {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || staffCtx.user.role !== 'owner') {
    return NextResponse.json({ error: 'Owners only.' }, { status: 403 });
  }

  const db = getDb();
  return NextResponse.json({ matrix: db.rolePerms });
}

export async function POST(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || staffCtx.user.role !== 'owner') {
    return NextResponse.json({ error: 'Owners only.' }, { status: 403 });
  }

  try {
    const rawMatrix = await req.json();
    const cleanMatrix: RolePerms = normaliseRolePerms(rawMatrix);

    mutateDb((d) => {
      d.rolePerms = cleanMatrix;

      logAuditInternal(d, {
        actorId: staffCtx.user.id,
        actorName: staffCtx.user.name,
        role: staffCtx.user.role,
        action: 'access.matrix_update',
        target: 'Permission Matrix',
        details: 'Updated role-based permission matrix',
      });
    });

    return NextResponse.json({ matrix: cleanMatrix });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Matrix update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
