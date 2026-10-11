import { SHOP_COUNT } from '@/lib/catalog';
import { requireStaff, worksAt } from '@/lib/server/auth';
import { fail, int, json, route } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';
import { tableKey } from '@/lib/server/tableCodes';

/** The signatures for one shop's table QR codes: `?loc=0` gives `{ codes: [{ n: 1, key }, …] }`, to print on the cards. */
export const GET = route(async (req) => {
  const ctx = await requireStaff(['shops.manage']);
  const loc = int(new URL(req.url).searchParams.get('loc'), 0, SHOP_COUNT - 1);
  if (loc === null) return fail(400, 'Which shop?');
  if (!worksAt(ctx.user, loc)) fail(403, "You don't work at that shop.");
  const { shops } = await getSettings();
  const codes = await Promise.all(Array.from({ length: shops[loc].tables }, async (_, i) => ({ n: i + 1, key: await tableKey(loc, i + 1) })));
  return json({ codes });
});
