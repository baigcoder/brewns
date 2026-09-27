import { DEFAULT_ROLE_PERMS, normaliseRolePerms, OWNER_ONLY, PERMISSIONS, ROLE_INFO, ROLES, type Permission, type Role } from '@/lib/rbac';
import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, json, readBody, route } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { updateSettings } from '@/lib/server/settings';

export const GET = route(async () => {
  const ctx = await requireStaff(['access.manage']);
  return json({ rolePerms: ctx.settings.rolePerms, defaults: DEFAULT_ROLE_PERMS });
});

/** `{ role, perm, on }` flips one box; `{ reset: role }` puts a role back to its defaults. Owners only. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['access.manage']);
  const b = await readBody(req);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  if (b.reset) {
    const role = String(b.reset) as Role;
    if (!ROLES.includes(role) || role === 'owner') fail(400, 'Which role?');
    const s = await updateSettings((s) => void (s.rolePerms = normaliseRolePerms({ ...s.rolePerms, [role]: DEFAULT_ROLE_PERMS[role] })));
    await bumpLive();
    await audit(actor, `Reset the ${ROLE_INFO[role].label.toLowerCase()} role to its defaults`);
    return json({ rolePerms: s.rolePerms });
  }
  const role = String(b.role) as Role;
  const perm = String(b.perm) as Permission;
  if (!ROLES.includes(role)) fail(400, 'Which role?');
  if (!(perm in PERMISSIONS)) fail(400, 'Which permission?');
  if (role === 'owner') fail(400, 'Owners can always do everything.');
  if (OWNER_ONLY.includes(perm)) fail(400, `${PERMISSIONS[perm].label} stays with owners, so nobody can promote themselves.`);
  const on = !!b.on;
  const s = await updateSettings((s) => {
    const list = new Set(s.rolePerms[role]);
    if (on) list.add(perm);
    else list.delete(perm);
    s.rolePerms = normaliseRolePerms({ ...s.rolePerms, [role]: [...list] });
  });
  await bumpLive();
  await audit(actor, `${on ? 'Gave' : 'Took'} “${PERMISSIONS[perm].label}” ${on ? 'to' : 'from'} ${ROLE_INFO[role].label.toLowerCase()}s`);
  return json({ rolePerms: s.rolePerms });
});
