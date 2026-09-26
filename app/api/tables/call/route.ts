import { clientIp, fail, int, json, rateLimit, readBody, route } from '@/lib/server/http';
import { callWaiter } from '@/lib/server/orders';
import { getSettings } from '@/lib/server/settings';

/** "Call a waiter" or "the bill, please" from a table's QR code page. */
export const POST = route(async (req) => {
  const b = await readBody(req);
  const loc = int(b.loc, 0, 20);
  const table = int(b.table, 1, 200);
  if (loc === null || table === null) fail(400, 'Which table?');
  await rateLimit(`call:${loc}:${table}`, 4, 120, 'Your waiter has been called. They will be with you in a moment.');
  await rateLimit(`call-ip:${clientIp(req)}`, 10, 600);
  const call = await callWaiter(loc!, table!, b.kind === 'bill' ? 'bill' : 'waiter', await getSettings());
  return json({ ok: true, call });
});
