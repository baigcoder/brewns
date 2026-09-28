import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clearDemo, hasDemo, seedRealisticDay } from '@/lib/server/demo';
import { fail, json, readBody, route } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { updateSettings } from '@/lib/server/settings';

export const GET = route(async () => {
  await requireStaff(['reports.view']);
  return json({ demo: await hasDemo() });
});

/** `{ action: 'seed' | 'clear' | 'unpause_all' }` */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['reports.view']);
  const b = await readBody(req);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };

  if (b.action === 'unpause_all') {
    await updateSettings((s) => {
      s.shops.forEach((shop) => {
        shop.paused = false;
      });
    });
    await bumpLive();
    await audit(actor, 'Resumed online ordering across all shops');
    return json({ ok: true, message: 'All shops unpaused and open for orders.' });
  }

  if (b.action === 'seed') {
    const r = await seedRealisticDay();
    await audit(actor, 'Populated realistic café day simulation', `${r.created} orders across ${r.days.length} days`);
    return json({ ok: true, created: r.created, demo: true });
  }

  if (b.action === 'clear') {
    const r = await clearDemo();
    await audit(actor, 'Cleared sample data', `${r.removed} orders`);
    return json({ ok: true, removed: r.removed, demo: false });
  }

  return fail(400, 'Pick a valid action: seed, clear, or unpause_all.') as never;
});
