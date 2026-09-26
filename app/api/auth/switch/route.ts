import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { createStaffSession, STAFF_COOKIE_NAME } from '@/lib/server/auth';
import { effectivePermsFor, homeFor, ROLES, type Role } from '@/lib/rbac';
import { seedSampleData } from '@/lib/server/sampleData';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = (body.role || '').toLowerCase().trim() as Role;
    const email = (body.email || '').toLowerCase().trim();

    const db = getDb();
    if (Object.keys(db.staff).length === 0) {
      seedSampleData();
    }

    let user = null;
    if (role && ROLES.includes(role)) {
      user = Object.values(db.staff).find((u) => u.role === role && u.active);
    } else if (email) {
      user = Object.values(db.staff).find((u) => u.email.toLowerCase() === email && u.active);
    }

    if (!user) {
      return NextResponse.json(
        { error: `No active staff member found for ${role || email || 'requested role'}` },
        { status: 404 }
      );
    }

    const session = createStaffSession(user.id);
    const perms = effectivePermsFor(user, db.rolePerms);
    const homeUrl = homeFor(user.role, perms);

    // Record audit event
    mutateDb((d) => {
      d.audit.unshift({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        actorId: user.id,
        actorName: user.name,
        role: user.role,
        action: 'role.switch',
        target: user.role,
        details: `Station switched to ${user.name} (${user.role.toUpperCase()}) -> ${homeUrl}`,
      });
      if (d.audit.length > 500) {
        d.audit = d.audit.slice(0, 500);
      }
    });

    const res = NextResponse.json({
      ok: true,
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
    const message = err instanceof Error ? err.message : 'Role switch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
