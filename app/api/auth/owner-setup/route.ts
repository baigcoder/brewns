import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb, type StaffUser } from '@/lib/server/storage';
import { hashPassword, createStaffSession, STAFF_COOKIE_NAME } from '@/lib/server/auth';
import { permsFor } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json();
    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const db = getDb();
    const existingOwner = Object.values(db.staff).find((s) => s.role === 'owner');
    if (existingOwner) {
      return NextResponse.json({ error: 'An owner account is already established.' }, { status: 403 });
    }

    const ownerId = `usr_owner_${Date.now()}`;
    const newOwner: StaffUser = {
      id: ownerId,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      role: 'owner',
      shops: [0, 1, 2],
      active: true,
      passwordHash: hashPassword(String(password)),
      createdAt: Date.now(),
    };

    mutateDb((d) => {
      d.staff[ownerId] = newOwner;
    });

    const session = createStaffSession(ownerId);
    const perms = permsFor('owner', db.rolePerms);

    const res = NextResponse.json({
      user: {
        id: newOwner.id,
        name: newOwner.name,
        email: newOwner.email,
        phone: newOwner.phone,
        role: newOwner.role,
        shops: newOwner.shops,
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
    const message = err instanceof Error ? err.message : 'Setup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
