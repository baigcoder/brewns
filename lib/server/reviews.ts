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
  /** Reviews from a real order's link go live at once; anyone else's wait for the café. Older reviews have no status and count as approved. */
  status?: 'pending' | 'approved';
  helpful: number;       // upvote count
  createdAt: number;     // epoch ms
}

const KEY = 'reviews';

const isLive = (r: Review) => r.status !== 'pending';

/** Reviews the public sees, newest first: approved ones only. */
export async function listReviews(): Promise<Review[]> {
  const all = await kv.hall<Review>(KEY);
  return Object.values(all).filter(isLive).sort((a, b) => b.createdAt - a.createdAt);
}

/** Everything, for the console: what waits for approval, and what is live. */
export async function reviewsForConsole(): Promise<{ pending: Review[]; live: Review[] }> {
  const all = Object.values(await kv.hall<Review>(KEY)).sort((a, b) => b.createdAt - a.createdAt);
  return { pending: all.filter((r) => !isLive(r)), live: all.filter(isLive) };
}

export async function countPendingReviews(): Promise<number> {
  return Object.values(await kv.hall<Review>(KEY)).filter((r) => !isLive(r)).length;
}

/** Puts a waiting review on the site. Returns false if there is no such review. */
export async function approveReview(id: string): Promise<boolean> {
  const review = await kv.hget<Review>(KEY, id);
  if (!review) return false;
  await kv.hset(KEY, id, { ...review, status: 'approved' });
  return true;
}

/** Add a new review. Returns the created review. */
export async function addReview(data: {
  quote: string;
  name: string;
  place: string;
  order?: string;
  product?: string;
  stars: number;
  /** Set only by the server, for a review left through a real order's link. */
  verified?: boolean;
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
    verified: !!data.verified,
    status: data.verified ? 'approved' : 'pending',
    helpful: 0,
    createdAt: now.getTime(),
  };
  await kv.hset(KEY, id, review);
  return review;
}

/** Upvote a review. Returns new helpful count. */
export async function upvoteReview(id: string): Promise<number | null> {
  const review = await kv.hget<Review>(KEY, id);
  if (!review || !isLive(review)) return null;
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
