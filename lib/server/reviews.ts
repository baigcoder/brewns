/* Reviews — dynamic reviews stored in KV.
   Key: brewns:reviews (hash — id → JSON review)
   
   Each review: { id, quote, name, place, order, product, when, stars, verified, helpful, createdAt }
*/

import { kv } from './store';
import { randomBytes } from 'node:crypto';

export interface Review {
  id: string;
  quote: string;
  name: string;
  place: string;         // "Gulberg" | "DHA" | "Johar Town"
  order: string;         // what they ordered
  product: string;       // product slug for filtering
  when: string;          // "dd.mm" display date
  stars: number;         // 1–5
  verified: boolean;     // verified order?
  helpful: number;       // upvote count
  createdAt: number;     // epoch ms
}

const KEY = 'reviews';

/** Get all reviews, newest first. */
export async function listReviews(): Promise<Review[]> {
  const all = await kv.hall<Review>(KEY);
  return Object.values(all).sort((a, b) => b.createdAt - a.createdAt);
}

/** Add a new review. Returns the created review. */
export async function addReview(data: {
  quote: string;
  name: string;
  place: string;
  order?: string;
  product?: string;
  stars: number;
}): Promise<Review> {
  const id = randomBytes(6).toString('hex');
  const now = new Date();
  const review: Review = {
    id,
    quote: data.quote.trim(),
    name: data.name.trim(),
    place: data.place,
    order: data.order || '',
    product: data.product || '',
    when: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`,
    stars: Math.max(1, Math.min(5, Math.round(data.stars))),
    verified: false,
    helpful: 0,
    createdAt: now.getTime(),
  };
  await kv.hset(KEY, id, review);
  return review;
}

/** Upvote a review. Returns new helpful count. */
export async function upvoteReview(id: string): Promise<number | null> {
  const review = await kv.hget<Review>(KEY, id);
  if (!review) return null;
  review.helpful += 1;
  await kv.hset(KEY, id, review);
  return review.helpful;
}

/** Delete a review (owner/admin). */
export async function deleteReview(id: string): Promise<boolean> {
  const review = await kv.hget<Review>(KEY, id);
  if (!review) return false;
  await kv.hdel(KEY, id);
  return true;
}

/** Compute aggregate stats. */
export function computeStats(reviews: Review[]) {
  if (!reviews.length) return { avg: 0, total: 0, dist: [0, 0, 0, 0, 0] };
  const dist = [0, 0, 0, 0, 0]; // index 0 = 5-star, index 4 = 1-star
  for (const r of reviews) {
    dist[5 - r.stars] += 1;
  }
  const total = reviews.length;
  const sum = reviews.reduce((s, r) => s + r.stars, 0);
  const avg = Math.round((sum / total) * 10) / 10;
  const pct = dist.map((n) => Math.round((n / total) * 100));
  return { avg, total, dist: pct };
}
