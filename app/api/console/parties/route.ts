import { NextRequest, NextResponse } from 'next/server';
import { currentStaff } from '@/lib/server/auth';
import { kv } from '@/lib/server/store';

export async function GET() {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const all = Object.values((await kv.hall<any>('party_bookings')) || {});
  const parties = all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return NextResponse.json({
    parties,
    count: parties.length,
  });
}
