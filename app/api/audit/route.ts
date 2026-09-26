import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';
import { can } from '@/lib/rbac';

export async function GET() {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'audit.view'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = getDb();
  return NextResponse.json({ audit: db.audit || [] });
}
