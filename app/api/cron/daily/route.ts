import { sendDailyDigest } from '@/lib/server/digest';
import { fail, json, route, safeEqual } from '@/lib/server/http';
import { expireHolds } from '@/lib/server/orders';

/**
 * The once-a-day job (see vercel.json): cancels pay-first orders nobody paid for, which also puts their
 * stock back, and emails the owner how the day went. Vercel calls it with `Authorization: Bearer <CRON_SECRET>`;
 * without that secret set on the server it refuses to run, so nobody else can trigger it.
 */
export const GET = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) fail(503, 'Set CRON_SECRET in the host environment variables to allow scheduled jobs.');
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(given, secret)) fail(401, 'Not allowed.');
  const expired = await expireHolds();
  const digest = await sendDailyDigest();
  return json({ ok: true, expired, digest });
});
