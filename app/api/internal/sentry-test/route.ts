import * as Sentry from '@sentry/nextjs';
import { fail, json, route, safeEqual } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/**
 * A deliberately protected, on-demand Sentry delivery check. This is not a
 * public error route: callers need the separately configured test secret and
 * the exception is captured without disrupting a customer request.
 */
export const POST = route(async (req) => {
  const secret = process.env.SENTRY_TEST_SECRET;
  const provided = req.headers.get('x-sentry-test-secret');
  if (!secret || !safeEqual(provided, secret)) fail(404, 'Not found.');
  if (!process.env.SENTRY_DSN) fail(503, 'Sentry is not configured.');

  const eventId = Sentry.captureException(new Error('Sentry delivery verification'), {
    tags: { source: 'manual-verification', environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown' },
  });
  await Sentry.flush(2_000);

  return json({ ok: true, eventId });
});
