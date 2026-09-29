import { LOC_TITLES } from '@/lib/catalog';
import { clientIp, fail, json, rateLimit, readBody, route, safeEqual, str } from '@/lib/server/http';
import { getOrder } from '@/lib/server/orders';
import { addReview } from '@/lib/server/reviews';
import { kv } from '@/lib/server/store';

type Ctx = { params: Promise<{ number: string }> };

const RECEIVED = ['collected', 'delivered', 'served'];

/** Loads the order for a review link; the tracking key in the link is the proof it is theirs. */
async function reviewable(req: Request, ctx: Ctx) {
  const number = Number((await ctx.params).number);
  const key = new URL(req.url).searchParams.get('k') || '';
  const o = Number.isInteger(number) ? await getOrder(number) : null;
  if (!o || !safeEqual(o.key, key)) return fail(404, 'No such order.');
  return o;
}

/** What the review page needs: who it's for, what they had, and whether it can be reviewed. */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const o = await reviewable(req, ctx);
  const done = RECEIVED.includes(o.status);
  const already = !!(await kv.get(`reviewed:${o.number}`));
  return json({
    number: o.number,
    name: o.name,
    shop: LOC_TITLES[o.loc],
    items: o.items.map((i) => i.name),
    reason: !done ? 'notyet' : already ? 'already' : '',
  });
});

/** One verified review per order: `{ stars, quote }`. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  await rateLimit(`order-review:${clientIp(req)}`, 10, 3600);
  const o = await reviewable(req, ctx);
  if (!RECEIVED.includes(o.status)) fail(409, 'You can review it once you have it.');
  const b = await readBody(req);
  const stars = Number(b.stars);
  const quote = str(b.quote, 500);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, 'Pick 1 to 5 stars.');
  if (quote.length < 3) fail(400, 'Add a few words about it.');
  if (!(await kv.set(`reviewed:${o.number}`, 1, { nx: true }))) fail(409, 'This order has already been reviewed. Thank you!');
  const review = await addReview({
    quote,
    name: o.name.split(' ')[0] || 'Guest',
    place: (LOC_TITLES[o.loc] || '').split(',')[0],
    order: o.items
      .map((i) => i.name.toLowerCase())
      .slice(0, 3)
      .join(', '),
    product: o.items[0]?.id || '',
    stars,
    verified: true,
  });
  return json({ review }, 201);
});
