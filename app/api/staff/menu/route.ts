import { catalogItem } from '@/lib/catalog';
import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { fail, json, readBody, route, str } from '@/lib/server/http';
import { bumpLive } from '@/lib/server/orders';
import { setStock, updateSettings } from '@/lib/server/settings';

/**
 * Sold out, or back on: `{ id, out }`. Or a count of what's left: `{ id, stock: 12 }`
 * (zero sells it out, `null` stops counting). The site hides "add" for sold-out items within seconds.
 */
export const POST = route(async (req) => {
  const ctx = await requireStaff(['menu.availability']);
  const b = await readBody(req);
  const item = catalogItem(str(b.id, 60));
  if (!item) fail(404, 'No such item.');
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };

  if ('stock' in b) {
    const count = b.stock === null ? null : Number(b.stock);
    if (count !== null && !(Number.isInteger(count) && count >= 0 && count <= 9999)) fail(400, 'Enter a whole number from 0 to 9999.');
    const s = await setStock(item!.id, count);
    await bumpLive();
    await audit(actor, count === null ? 'Stopped counting stock' : `Set stock to ${count}`, item!.name);
    return json({ soldOut: s.soldOut, stock: s.stock });
  }

  const out = !!b.out;
  const s = await updateSettings((s) => {
    if (!out && s.stock[item!.id] === 0) fail(409, 'It is out of stock. Set a new stock count to put it back.');
    s.soldOut = out ? [...new Set([...s.soldOut, item!.id])] : s.soldOut.filter((id) => id !== item!.id);
  });
  await bumpLive();
  await audit(actor, out ? 'Marked sold out' : 'Back on the menu', item!.name);
  return json({ soldOut: s.soldOut, stock: s.stock });
});
