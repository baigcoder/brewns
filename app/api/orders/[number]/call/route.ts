import { clientIp, fail, json, rateLimit, readBody, route, safeEqual, str } from '@/lib/server/http';
import { getOrder } from '@/lib/server/orders';
import { callAct, callView, getCall } from '@/lib/server/rtc';

type Ctx = { params: Promise<{ number: string }> };

/** The customer's side of a call with their rider. The order's key is the password, as for tracking. */
const ownOrder = async (ctx: Ctx, key: string) => {
  const number = Number((await ctx.params).number);
  const o = Number.isInteger(number) ? await getOrder(number) : null;
  if (!o || !safeEqual(o.key, key)) fail(404, 'No such order.');
  return o!;
};

/** Polled every second while a call is ringing or on. */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const o = await ownOrder(ctx, new URL(req.url).searchParams.get('k') || '');
  return json({ call: callView(await getCall(o.number)) });
});

/** `{ k, op: 'offer' | 'answer' | 'end', sdp? }` */
export const POST = route(async (req: Request, ctx: Ctx) => {
  await rateLimit(`rtc:${clientIp(req)}`, 40, 600);
  const b = await readBody(req);
  const o = await ownOrder(ctx, str(b.k, 64));
  return json({ call: await callAct(o, 'you', b) });
});
