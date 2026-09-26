import { currentStaff, endSession, saveUser } from '@/lib/server/auth';
import { json, readBody, route } from '@/lib/server/http';

/** Signs out here, or with `everywhere` ends every session of the account (staff and customers alike). */
export const POST = route(async (req) => {
  const b = await readBody(req);
  const kind = b.kind === 'customer' ? 'customer' : 'staff';
  if (b.everywhere && kind === 'staff') {
    const ctx = await currentStaff();
    if (ctx) await saveUser({ ...ctx.user, v: ctx.user.v + 1 });
  }
  await endSession(kind);
  return json({ ok: true, next: kind === 'staff' ? '/staff/signin' : '/' });
});
