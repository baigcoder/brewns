import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clearDemo, hasDemo, seedDemo } from '@/lib/server/demo';
import { fail, json, readBody, route } from '@/lib/server/http';

export const GET = route(async () => {
  await requireStaff(['reports.view']);
  return json({ demo: await hasDemo() });
});

/** `{ action: 'seed' | 'clear' }`. Owners only: it fills (or empties) the reports. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['reports.view']);
  if (ctx.role !== 'owner') fail(403, 'Only an owner can load or clear sample data.');
  const b = await readBody(req);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  if (b.action === 'seed') {
    if (await hasDemo()) fail(409, 'Sample data is already loaded. Clear it first.');
    const r = await seedDemo();
    await audit(actor, 'Loaded sample data', `${r.orders} orders`);
    return json(r);
  }
  if (b.action === 'clear') {
    const r = await clearDemo();
    await audit(actor, 'Cleared sample data', `${r.removed} orders`);
    return json(r);
  }
  return fail(400, 'Seed or clear?');
});
