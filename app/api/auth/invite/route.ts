import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb, type StaffUser } from '@/lib/server/storage';
import { hashPassword, createStaffSession, STAFF_COOKIE_NAME } from '@/lib/server/auth';
import { permsFor } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const { token, name, phone, password, riderPlate } = await req.json();
    if (!token || !name || !phone || !password) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const db = getDb();
    const invite = db.invites[token];
    if (!invite || invite.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired invitation link.' }, { status: 400 });
    }

    const userId = `usr_${invite.role}_${Date.now()}`;
    const newStaff: StaffUser = {
      id: userId,
      name: String(name).trim(),
      email: invite.email || `${invite.role}.${Date.now()}@brewns.pk`,
      phone: String(phone).trim(),
      role: invite.role,
      shops: invite.shops,
      active: true,
      passwordHash: hashPassword(String(password)),
      riderPlate: riderPlate ? String(riderPlate).trim() : undefined,
      createdAt: Date.now(),
    };

    mutateDb((d) => {
      d.staff[userId] = newStaff;
      delete d.invites[token];
    });

    const session = createStaffSession(userId);
    const perms = permsFor(newStaff.role, db.rolePerms);

    const res = NextResponse.json({
      user: {
        id: newStaff.id,
        name: newStaff.name,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        shops: newStaff.shops,
      },
      perms,
    });

    res.cookies.set(STAFF_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Accept invite failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
