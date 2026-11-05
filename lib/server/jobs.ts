import { Client, Receiver } from '@upstash/qstash';
import { SITE_URL } from '@/lib/site';
import { sendBookingConfirmationEmail, type BookingEmailPayload } from './email';
import { sendBookingWhatsappNotification } from './smsWhatsapp';
import { recordDurableEvent } from './database';
import { queueConfigured } from './production';

export type BookingJob = { kind: 'booking-email' | 'booking-whatsapp'; payload: BookingEmailPayload };

const client = () => new Client({ token: process.env.QSTASH_TOKEN! });

export async function enqueueBookingJobs(payload: BookingEmailPayload) {
  if (!queueConfigured()) return false;
  const url = `${SITE_URL}/api/internal/jobs`;
  await Promise.all([
    client().publishJSON({ url, body: { kind: 'booking-email', payload } satisfies BookingJob, retries: 3 }),
    client().publishJSON({ url, body: { kind: 'booking-whatsapp', payload } satisfies BookingJob, retries: 3 }),
  ]);
  return true;
}

export async function verifyJob(signature: string, body: string) {
  if (!queueConfigured() || !signature) return false;
  return new Receiver({ currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY! }).verify({ signature, body });
}

export async function runJob(job: BookingJob) {
  try {
    if (job.kind === 'booking-email') await sendBookingConfirmationEmail(job.payload);
    else await sendBookingWhatsappNotification(job.payload);
  } catch (error) {
    await recordDurableEvent('job.failed', job.payload.code, { kind: job.kind, message: error instanceof Error ? error.message : 'unknown' }).catch(() => {});
    throw error;
  }
}
