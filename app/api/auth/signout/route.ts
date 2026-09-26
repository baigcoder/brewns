import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { STAFF_COOKIE_NAME, deleteSession } from '@/lib/server/auth';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (token) {
    deleteSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
