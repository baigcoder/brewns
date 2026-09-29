import { requireStaff } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';
import { clientIp, fail, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { addReview, computeStats, deleteReview, listReviews, upvoteReview } from '@/lib/server/reviews';

/** GET — all reviews and their stats, for the public page. */
export const GET = route(async () => {
  const reviews = await listReviews();
  return json({ reviews, stats: computeStats(reviews) });
});

/** POST — a new review, `{ action: "add", quote, name, place, order?, product?, stars }`, or `{ action: "upvote", id }`. */
export const POST = route(async (req) => {
  const b = await readBody(req);

  if (b.action === 'upvote') {
    await rateLimit(`review-vote:${clientIp(req)}`, 30, 600);
    const id = str(b.id, 40);
    if (!id) fail(400, 'Missing review id');
    const helpful = await upvoteReview(id);
    if (helpful === null) fail(404, 'Review not found');
    return json({ helpful });
  }

  await rateLimit(`review-add:${clientIp(req)}`, 5, 3600, 'That is a lot of reviews in an hour. Try again later.');
  const quote = str(b.quote, 501);
  const name = str(b.name, 60);
  const place = str(b.place, 40);
  const stars = Number(b.stars);
  if (!quote || !name || !place || !stars) fail(400, 'Missing required fields: quote, name, place, stars');
  if (!(stars >= 1 && stars <= 5)) fail(400, 'Stars must be 1–5');
  if (quote.length > 500) fail(400, 'Review too long (max 500 chars)');
  const review = await addReview({ quote, name, place, order: str(b.order, 120), product: str(b.product, 60), stars });
  return json({ review }, 201);
});

/** DELETE — removes a review by id. Staff who manage shops only: it used to be open to anyone. */
export const DELETE = route(async (req) => {
  const ctx = await requireStaff(['shops.manage']);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) fail(400, 'Missing id parameter');
  const success = await deleteReview(id!);
  if (success) await audit({ id: ctx.user.id, name: ctx.user.name, role: ctx.role }, 'Deleted a review', id!);
  return json({ success });
});
