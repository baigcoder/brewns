import { requireStaff } from '@/lib/server/auth';
import { fail, json, readBody, route } from '@/lib/server/http';
import { getOrder } from '@/lib/server/orders';
import { callAct, callView, getCall } from '@/lib/server/rtc';

type Ctx = { params: Promise<{ number: string }> };

/** The rider's side of a call with the customer: only on a delivery that is theirs. */
const ownRide = async (c: Ctx) => {
  const ctx = await requireStaff(['delivery.ride']);
  const number = Number((await c.params).number);
  const o = Number.isInteger(number) ? await getOrder(number) : null;
  if (!o || o.rider?.id !== ctx.user.id) fail(404, 'That delivery is not yours.');
  return o!;
};

/** Polled every second while a call is ringing or on. */
export const GET = route(async (_req: Request, c: Ctx) => json({ call: callView(await getCall((await ownRide(c)).number)) }));

/** `{ op: 'offer' | 'answer' | 'end', sdp? }` */
export const POST = route(async (req: Request, c: Ctx) => {
  const o = await ownRide(c);
  return json({ call: await callAct(o, 'rider', await readBody(req)) });
});
