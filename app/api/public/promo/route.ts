import { clientIp, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { getSettings } from '@/lib/server/settings';

/** Checks a promo code at checkout. */
export const POST = route(async (req) => {
  await rateLimit(`promo:${clientIp(req)}`, 30, 600, 'Too many codes tried. Wait a few minutes.');
  const code = str((await readBody(req)).code, 24).toUpperCase();
  const promo = (await getSettings()).promos.find((p) => p.active && p.code === code);
  return json(promo ? { valid: true, code: promo.code, pct: promo.pct } : { valid: false });
});
