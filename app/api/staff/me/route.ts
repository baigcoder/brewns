import { hashPassword, passwordProblem, publicUser, requireStaff, saveUser, startSession, verifyPassword } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, json, readBody, route, str } from '@/lib/server/http';

export const GET = route(async () => {
  const ctx = await requireStaff();
  return json({ user: publicUser(ctx.user), perms: ctx.perms });
});

/** Your own name, phone, or password. Changing the password signs out your other devices. */
export const POST = route(async (req) => {
  const ctx = await requireStaff();
  const b = await readBody(req);
  const next = { ...ctx.user };
  if (b.name !== undefined) {
    const name = str(b.name, 60).replace(/\s+/g, ' ');
    if (name.length < 2) fail(400, 'Add your name.');
    next.name = name;
  }
  if (b.phone !== undefined) next.phone = str(b.phone, 20);
  if (b.newPassword !== undefined) {
    if (!(await verifyPassword(String(b.password || ''), ctx.user.passHash))) fail(403, "Your current password isn't right.");
    const weak = passwordProblem(String(b.newPassword));
    if (weak) fail(400, weak);
    next.passHash = await hashPassword(String(b.newPassword));
    next.v += 1;
  }
  await saveUser(next, ctx.user);
  if (b.newPassword !== undefined) await startSession(next); // this device stays signed in, the others don't
  if (b.newPassword !== undefined) await audit({ id: next.id, name: next.name, role: ctx.role }, 'Changed their password');
  return json({ user: publicUser(next) });
});
