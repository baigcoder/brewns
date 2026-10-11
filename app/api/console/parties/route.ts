import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/server/auth';
import { route } from '@/lib/server/http';
import { kv } from '@/lib/server/store';

async function handleGet() {
  const staff = await requireStaff(['reports.view', 'floor.tables', 'orders.view'], 'any');

  const all = Object.values((await kv.hall<any>('party_bookings')) || {});
  const parties = all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return NextResponse.json({
    parties,
    count: parties.length,
  });
}

export const GET = route(handleGet);
