import { neon } from '@neondatabase/serverless';
import { databaseConfigured } from './production';

type EventKind = 'order.created' | 'reservation.created' | 'job.failed';

const db = () => {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
};

/** Append-only operational ledger. Redis remains the low-latency coordination
 * store; this table is the durable, queryable production record. */
export async function recordDurableEvent(kind: EventKind, subject: string, payload: unknown) {
  const sql = db();
  if (!sql) return false;
  await sql`
    INSERT INTO operational_events (kind, subject, payload)
    VALUES (${kind}, ${subject}, ${JSON.stringify(payload)}::jsonb)
  `;
  return true;
}

export const databaseReady = () => databaseConfigured();

export async function databaseHealthy() {
  const sql = db();
  if (!sql) return false;
  await sql`SELECT 1`;
  return true;
}
