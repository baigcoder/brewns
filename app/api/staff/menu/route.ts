import { catalogItem } from '@/lib/catalog';
import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, json, readBody, route, str } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { updateSettings } from '@/lib/server/settings';

/** Sold out, or back on: `{ id, out }`. The site hides "add" for sold-out items within seconds. */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['menu.availability']);
  const b = await readBody(req);
  const item = catalogItem(str(b.id, 60));
  if (!item) fail(404, 'No such item.');
  const out = !!b.out;
  const s = await updateSettings((s) => {
    s.soldOut = out ? [...new Set([...s.soldOut, item!.id])] : s.soldOut.filter((id) => id !== item!.id);
  });
  await bumpLive();
  await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, out ? 'Marked sold out' : 'Back on the menu', item!.name);
  return json({ soldOut: s.soldOut });
});
