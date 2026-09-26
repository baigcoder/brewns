import { ownerExists } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';

/**
 * What the site needs to know when it loads: whether orders go to the console
 * (so tracking follows the café, not the clock), what has sold out, and which
 * shops have paused online orders or are running behind.
 */
export const GET = route(async () => {
  const [live, s] = await Promise.all([ownerExists(), getSettings()]);
  return json({
    live: live && s.online,
    soldOut: s.soldOut,
    shops: s.shops.map(({ paused, extraMin, tables }) => ({ paused, extraMin, tables })),
    promoHint: s.promos.find((p) => p.active)?.code || '',
  });
});
