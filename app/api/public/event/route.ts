import { clientIp, json, rateLimit, readBody, route } from '@/lib/server/http';
import { isEvent, recordEvent } from '@/lib/server/events';

/**
 * POST `{ e }`: one anonymous funnel event (visit, add_to_bag, bag_open,
 * checkout_start, order_placed). Only a daily count is kept, nothing about who
 * sent it; the address is used for rate limiting alone. Unknown names are ignored.
 */
export const POST = route(async (req) => {
  await rateLimit(`event:${clientIp(req)}`, 90, 60);
  const b = await readBody(req, 400);
  if (isEvent(b.e)) await recordEvent(b.e);
  return json({ ok: true });
});
