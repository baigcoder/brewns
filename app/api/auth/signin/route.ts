import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { verifyPassword, createStaffSession, STAFF_COOKIE_NAME } from '@/lib/server/auth';
import { effectivePermsFor, homeFor } from '@/lib/rbac';
import { seedSampleData } from '@/lib/server/sampleData';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const db = getDb();
    // Auto-seed if database has no staff yet
    if (Object.keys(db.staff).length === 0) {
      seedSampleData();
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = Object.values(db.staff).find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = verifyPassword(String(password), user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const session = createStaffSession(user.id);
    const perms = effectivePermsFor(user, db.rolePerms);
    const homeUrl = homeFor(user.role, perms);

    // Record login in audit log
    mutateDb((d) => {
      d.audit.unshift({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        actorId: user.id,
        actorName: user.name,
        role: user.role,
        action: 'auth.signin',
        target: user.role,
        details: `Staff authenticated: ${user.name} (${user.role.toUpperCase()}) -> ${homeUrl}`,
      });
      if (d.audit.length > 500) {
        d.audit = d.audit.slice(0, 500);
      }
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        shops: user.shops,
      },
      perms,
      homeUrl,
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
    const message = err instanceof Error ? err.message : 'Sign in failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
