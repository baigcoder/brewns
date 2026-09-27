import { clientIp, fail, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { customerAct, getOrder, publicOrder } from '@/lib/server/orders';

type Ctx = { params: Promise<{ number: string }> };

/** The customer's view of their order. The key from placing it is the password. */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const number = Number((await ctx.params).number);
  const key = new URL(req.url).searchParams.get('k') || '';
  const o = Number.isInteger(number) ? await getOrder(number) : null;
  if (!o || !key || o.key !== key) return fail(404, 'No such order.');
  return json({ order: publicOrder(o) });
});

/** Cancel (before it's started), "I've collected it", or a message to the café. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const number = Number((await ctx.params).number);
  await rateLimit(`order-act:${clientIp(req)}`, 60, 600);
  const b = await readBody(req);
  const type = b.type === 'cancel' || b.type === 'collected' || b.type === 'message' ? b.type : null;
  if (!type || !Number.isInteger(number)) fail(400, 'Unknown action.');
  const o = await customerAct(number, str(b.k, 64), { type: type!, text: str(b.text, 300) });
  return json({ order: publicOrder(o) });
});
