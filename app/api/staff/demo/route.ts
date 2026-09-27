import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clearDemo, hasDemo } from '@/lib/server/demo';
import { fail, json, readBody, route } from '@/lib/server/http';

export const GET = route(async () => {
  await requireStaff(['reports.view']);
  return json({ demo: await hasDemo() });
});

/** `{ action: 'clear' }`: removes sample orders left by an older version. Owners only. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['reports.view']);
  if (ctx.role !== 'owner') fail(403, 'Only an owner can clear sample data.');
  const b = await readBody(req);
  if (b.action !== 'clear') fail(400, 'Sample data can only be cleared now.');
  const r = await clearDemo();
  await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, 'Cleared sample data', `${r.removed} orders`);
  return json(r);
});
