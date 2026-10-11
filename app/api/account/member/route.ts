import { addAddress, cleanAddress, cleanFavs, mergeFavs, removeAddress, setFav } from '@/lib/member';
import { newId, requireCustomer } from '@/lib/server/auth';
import { fail, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { memberKey, readMember } from '@/lib/server/member';
import { kv, withLock } from '@/lib/server/store';

/** The signed-in customer's favourites and saved addresses. */
export const GET = route(async () => {
  const u = await requireCustomer();
  return json(await readMember(u.id));
});

/**
 * Changes to them: `{ action: 'fav', id, on }`, `{ action: 'favs', ids }` (bring a phone's favourites into the account),
 * `{ action: 'addr-save', label, address, area }` or `{ action: 'addr-delete', id }`. Replies with the whole picture.
 */
export const POST = route(async (req) => {
  const u = await requireCustomer();
  await rateLimit(`member:${u.id}`, 120, 600);
  const b = await readBody(req);
  const next = await withLock(memberKey(u.id), async () => {
    const m = await readMember(u.id);
    if (b.action === 'fav') {
      if (typeof b.id !== 'string') fail(400, 'Which item?');
      m.favs = setFav(m.favs, b.id as string, b.on !== false);
    } else if (b.action === 'favs') {
      m.favs = mergeFavs(m.favs, b.ids);
    } else if (b.action === 'addr-save') {
      const clean = cleanAddress({ label: b.label, address: b.address, area: b.area });
      if (!clean.ok) return fail(400, clean.error) as never;
      const r = addAddress(m.addrs, clean.value, () => newId('ad'));
      if (!r.ok) return fail(409, r.error) as never;
      m.addrs = r.list;
    } else if (b.action === 'addr-delete') {
      m.addrs = removeAddress(m.addrs, str(b.id, 40));
    } else return fail(400, 'Favourite, save an address or delete one?') as never;
    m.favs = cleanFavs(m.favs);
    await kv.set(memberKey(u.id), m);
    return m;
  });
  return json(next);
});
