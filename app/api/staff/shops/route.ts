import { LOC_TITLES, SHOP_COUNT } from '@/lib/catalog';
import { requireStaff, worksAt } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, int, json, readBody, route, str } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { updateSettings } from '@/lib/server/settings';

/** A shop's switches (`{ loc, paused?, extraMin?, autoAccept?, tables? }`), or `{ online }` for the whole café (owner only). */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['shops.manage']);
  const b = await readBody(req);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  if (typeof b.online === 'boolean') {
    if (ctx.role !== 'owner') fail(403, 'Only an owner can switch online orders on or off for the whole café.');
    const s = await updateSettings((s) => void (s.online = b.online as boolean));
    await bumpLive();
    await audit(actor, b.online ? 'Switched on orders through the console' : 'Switched off orders through the console');
    return json({ settings: { online: s.online, shops: s.shops } });
  }
  if (b.prepay && typeof b.prepay === 'object') {
    const p = b.prepay as Record<string, unknown>;
    const min = p.minTotal === null ? null : int(p.minTotal, 100, 100000);
    const hold = int(p.holdMin, 3, 60);
    if (p.minTotal !== null && min === null) fail(400, 'The minimum is Rs 100 to Rs 100,000, or off.');
    if (hold === null) fail(400, 'Hold the order for 3 to 60 minutes.');
    const payTo = str(p.payTo, 200);
    if (payTo.length < 5) fail(400, 'Say where customers send the money (a Raast ID or a wallet number).');
    const s = await updateSettings((s) => void (s.prepay = { minTotal: min, holdMin: hold!, payTo }));
    await bumpLive();
    await audit(actor, min === null ? 'Switched off pay-first delivery' : `Pay-first delivery from Rs ${min}, held ${hold} min`);
    return json({ settings: { online: s.online, shops: s.shops, prepay: s.prepay } });
  }
  const loc = int(b.loc, 0, SHOP_COUNT - 1);
  if (loc === null) return fail(400, 'Which shop?');
  if (!worksAt(ctx.user, loc)) fail(403, "You don't work at that shop.");
  const changes: string[] = [];
  const s = await updateSettings((s) => {
    const shop = s.shops[loc];
    if (typeof b.paused === 'boolean') {
      shop.paused = b.paused;
      changes.push(b.paused ? 'paused online orders' : 'resumed online orders');
    }
    if (b.extraMin !== undefined) {
      const m = int(b.extraMin, 0, 90);
      if (m === null) fail(400, 'Extra wait is 0 to 90 minutes.');
      shop.extraMin = m!;
      changes.push(`extra wait ${m} min`);
    }
    if (typeof b.autoAccept === 'boolean') {
      shop.autoAccept = b.autoAccept;
      changes.push(b.autoAccept ? 'auto-accept on' : 'auto-accept off');
    }
    if (b.tables !== undefined) {
      const t = int(b.tables, 0, 80);
      if (t === null) fail(400, 'Between 0 and 80 tables.');
      shop.tables = t!;
      changes.push(`${t} tables`);
    }
  });
  await bumpLive();
  if (changes.length) await audit(actor, `${LOC_TITLES[loc]}: ${changes.join(', ')}`);
  return json({ settings: { online: s.online, shops: s.shops } });
});
