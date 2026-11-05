import { json } from '@/lib/server/http';
import { runJob, type BookingJob, verifyJob } from '@/lib/server/jobs';

/** QStash-signed callback. It intentionally bypasses browser origin checks. */
export async function POST(req: Request) {
  const body = await req.text();
  const valid = await verifyJob(req.headers.get('upstash-signature') || '', body);
  if (!valid) return json({ error: 'Unauthorized.' }, 401);
  try {
    const job = JSON.parse(body) as BookingJob;
    if (!job || !['booking-email', 'booking-whatsapp'].includes(job.kind) || !job.payload?.code) return json({ error: 'Bad job.' }, 400);
    await runJob(job);
    return json({ ok: true });
  } catch (error) {
    console.error('[jobs]', error);
    return json({ error: 'Job failed.' }, 500);
  }
}
