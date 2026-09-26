import { NextResponse } from 'next/server';
import { getCurrentStaff } from '@/lib/server/auth';
import { getDb } from '@/lib/server/storage';
import { seedSampleData } from '@/lib/server/sampleData';

export async function GET() {
  const db = getDb();
  if (Object.keys(db.staff).length === 0) {
    seedSampleData();
  }

  const staffCtx = await getCurrentStaff();
  if (!staffCtx) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: staffCtx.user.id,
      name: staffCtx.user.name,
      email: staffCtx.user.email,
      phone: staffCtx.user.phone,
      role: staffCtx.user.role,
      shops: staffCtx.user.shops,
      riderPlate: staffCtx.user.riderPlate,
    },
    perms: staffCtx.perms,
  });
}
