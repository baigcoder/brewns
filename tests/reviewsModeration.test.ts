import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'brewns-rev-'));
process.env.BREWNS_DATA_FILE = path.join(dir, 'data.json');
delete process.env.KV_REST_API_URL;
delete process.env.UPSTASH_REDIS_REST_URL;

let reviews: typeof import('@/lib/server/reviews');
let store: typeof import('@/lib/server/store');
beforeAll(async () => {
  reviews = await import('@/lib/server/reviews');
  store = await import('@/lib/server/store');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const draft = { quote: 'Lovely flat white and a quiet corner.', name: 'Sara', place: 'DHA', stars: 5 };

describe('review moderation', () => {
  it('holds a review from someone who has not ordered, away from the public', async () => {
    const r = await reviews.addReview(draft);
    expect(r.status).toBe('pending');
    expect((await reviews.listReviews()).some((x) => x.id === r.id)).toBe(false);
    expect((await reviews.reviewsForConsole()).pending.some((x) => x.id === r.id)).toBe(true);
    expect(await reviews.countPendingReviews()).toBeGreaterThan(0);
  });

  it('puts a review from a real order live at once', async () => {
    const r = await reviews.addReview({ ...draft, verified: true });
    expect(r.status).toBe('approved');
    expect((await reviews.listReviews()).some((x) => x.id === r.id)).toBe(true);
  });

  it('shows a held review once it is approved, and not before', async () => {
    const r = await reviews.addReview({ ...draft, quote: 'Held until approved.' });
    expect(await reviews.approveReview(r.id)).toBe(true);
    expect((await reviews.listReviews()).some((x) => x.id === r.id)).toBe(true);
    expect(await reviews.approveReview('nope')).toBe(false);
  });

  it('keeps held reviews out of the star average, so they cannot move it', async () => {
    const before = reviews.computeStats(await reviews.listReviews());
    for (let i = 0; i < 20; i++) await reviews.addReview({ ...draft, stars: 1 });
    const after = reviews.computeStats(await reviews.listReviews());
    expect(after).toEqual(before);
  });

  it('does not count votes on a review nobody can see', async () => {
    const r = await reviews.addReview(draft);
    expect(await reviews.upvoteReview(r.id)).toBeNull();
    await reviews.approveReview(r.id);
    expect(await reviews.upvoteReview(r.id)).toBe(1);
  });

  it('still shows reviews saved before moderation existed', async () => {
    await store.kv.hset('reviews', 'old1', { id: 'old1', quote: 'From the early days.', name: 'Ali', place: 'DHA', order: '', product: '', when: '01.01', stars: 4, verified: false, helpful: 3, createdAt: 1 });
    expect((await reviews.listReviews()).some((x) => x.id === 'old1')).toBe(true);
  });

  it('deletes held and live reviews alike', async () => {
    const r = await reviews.addReview(draft);
    expect(await reviews.deleteReview(r.id)).toBe(true);
    expect((await reviews.reviewsForConsole()).pending.some((x) => x.id === r.id)).toBe(false);
  });
});
