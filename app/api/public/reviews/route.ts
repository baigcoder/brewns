import { NextRequest, NextResponse } from 'next/server';
import { listReviews, addReview, upvoteReview, deleteReview, computeStats } from '@/lib/server/reviews';

/** GET — return all reviews + aggregate stats for the public landing page. */
export async function GET() {
  const reviews = await listReviews();
  const stats = computeStats(reviews);
  return NextResponse.json({ reviews, stats });
}

/** POST — submit a new review or upvote an existing one.
 *  Body: { action: "add", quote, name, place, order?, product?, stars }
 *     or { action: "upvote", id }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'upvote') {
      if (!body.id) return NextResponse.json({ error: 'Missing review id' }, { status: 400 });
      const helpful = await upvoteReview(body.id);
      if (helpful === null) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      return NextResponse.json({ helpful });
    }

    // Default action: add a review
    const { quote, name, place, order, product, stars } = body;
    if (!quote || !name || !place || !stars) {
      return NextResponse.json({ error: 'Missing required fields: quote, name, place, stars' }, { status: 400 });
    }
    if (typeof stars !== 'number' || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'Stars must be 1–5' }, { status: 400 });
    }
    if (quote.length > 500) {
      return NextResponse.json({ error: 'Review too long (max 500 chars)' }, { status: 400 });
    }

    const review = await addReview({ quote, name, place, order, product, stars });
    return NextResponse.json({ review }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

/** DELETE — remove a review by id. */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    const success = await deleteReview(id);
    return NextResponse.json({ success });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
