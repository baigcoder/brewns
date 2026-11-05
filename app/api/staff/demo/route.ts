import { requireStaff, worksAt } from '@/lib/server/auth';
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
  // These change live data and switch shops back on, so they belong with shop settings, not with reading reports.
  const ctx = await requireStaff(['shops.manage']);
  const b = await readBody(req);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  // Sample orders land in the real reports, so only an owner adds or clears them.
  if ((b.action === 'seed' || b.action === 'clear') && ctx.role !== 'owner') fail(403, 'Only an owner can add or clear sample data.');

  if (b.action === 'unpause_all') {
    await updateSettings((s) => {
      // Only the shops this person works at: someone tied to one shop must not switch on another's ordering.
      s.shops.forEach((shop, loc) => {
        if (worksAt(ctx.user, loc)) shop.paused = false;
      });
    });
    await bumpLive();
    const all = !ctx.user.shops.length;
    await audit(actor, all ? 'Resumed online ordering across all shops' : 'Resumed online ordering at their shops');
    return json({ ok: true, message: all ? 'All shops unpaused and open for orders.' : 'Your shops are unpaused and open for orders.' });
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
