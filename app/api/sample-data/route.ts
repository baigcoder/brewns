import { NextResponse } from 'next/server';
import { getCurrentStaff } from '@/lib/server/auth';
import { seedSampleData } from '@/lib/server/sampleData';

export async function POST() {
  const staffCtx = await getCurrentStaff();
  if (staffCtx && staffCtx.user.role !== 'owner') {
    return NextResponse.json({ error: 'Owners only.' }, { status: 403 });
  }

  seedSampleData();
  return NextResponse.json({ ok: true, message: 'Sample data seeded successfully.' });
}
