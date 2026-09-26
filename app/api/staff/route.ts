import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDb, mutateDb, type Invite } from '@/lib/server/storage';
import { getCurrentStaff, revokeStaffSessions } from '@/lib/server/auth';
import { can, outranks, type Role, ROLES, effectivePermsFor, type Permission } from '@/lib/rbac';
import { logAuditInternal } from '@/lib/server/orders';

export async function GET() {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'staff.view'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const db = getDb();
  const staffList = Object.values(db.staff).map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    shops: s.shops,
    active: s.active,
    riderPlate: s.riderPlate,
    customPerms: s.customPerms || [],
    deniedPerms: s.deniedPerms || [],
    effectivePerms: effectivePermsFor(s, db.rolePerms),
    createdAt: s.createdAt,
  }));

  const invites = Object.values(db.invites)
    .filter((inv) => inv.expiresAt > Date.now())
    .map((inv) => ({
      token: inv.token,
      role: inv.role,
      shops: inv.shops,
      email: inv.email,
      expiresAt: inv.expiresAt,
    }));

  return NextResponse.json({ staff: staffList, invites });
}

export async function POST(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'staff.manage'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { role, shops, email } = await req.json();
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
    }

    if (!outranks(staffCtx.user.role, role)) {
      return NextResponse.json({ error: 'You cannot invite someone of your own rank or higher.' }, { status: 403 });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const invite: Invite = {
      token,
      role: role as Role,
      shops: Array.isArray(shops) ? shops : [0],
      email: email ? String(email).trim().toLowerCase() : undefined,
      createdBy: staffCtx.user.name,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 86400000, // 7 days
    };

    mutateDb((d) => {
      d.invites[token] = invite;

      logAuditInternal(d, {
        actorId: staffCtx.user.id,
        actorName: staffCtx.user.name,
        role: staffCtx.user.role,
        action: 'staff.invite',
        target: invite.email || `New ${role}`,
        details: `Created invite for ${role} (Token: ${token.slice(0, 8)}...)`,
      });
    });

    return NextResponse.json({ invite });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invite creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const staffCtx = await getCurrentStaff();
  if (!staffCtx || (staffCtx.user.role !== 'owner' && !can(staffCtx.perms, 'staff.manage'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id, role, shops, active, riderPlate, customPerms, deniedPerms } = await req.json();
    const db = getDb();
    const targetStaff = db.staff[id];

    if (!targetStaff) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    if (!outranks(staffCtx.user.role, targetStaff.role)) {
      return NextResponse.json({ error: 'You cannot edit someone of your own rank or higher.' }, { status: 403 });
    }

    if (role && !outranks(staffCtx.user.role, role)) {
      return NextResponse.json({ error: 'You cannot assign a role of your own rank or higher.' }, { status: 403 });
    }

    let roleChanged = false;
    let deactivated = false;

    mutateDb((d) => {
      const s = d.staff[id];
      if (!s) return;
      if (role && ROLES.includes(role) && s.role !== role) {
        s.role = role;
        roleChanged = true;
      }
      if (Array.isArray(shops)) s.shops = shops;
      if (active !== undefined && s.active !== !!active) {
        s.active = !!active;
        if (!s.active) deactivated = true;
      }
      if (riderPlate !== undefined) s.riderPlate = String(riderPlate).trim();
      if (Array.isArray(customPerms) && staffCtx.user.role === 'owner') {
        s.customPerms = customPerms;
      }
      if (Array.isArray(deniedPerms) && staffCtx.user.role === 'owner') {
        s.deniedPerms = deniedPerms;
      }

      logAuditInternal(d, {
        actorId: staffCtx.user.id,
        actorName: staffCtx.user.name,
        role: staffCtx.user.role,
        action: 'staff.update',
        target: s.name,
        details: `Role: ${s.role}, Active: ${s.active}, Shops: [${s.shops.join(',')}]`,
      });
    });

    // Invalidate sessions immediately if deactivated or role altered
    if (deactivated || roleChanged) {
      revokeStaffSessions(id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update staff failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
