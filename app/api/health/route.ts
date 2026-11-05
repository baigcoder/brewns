import { json } from '@/lib/server/http';
import { databaseHealthy, databaseReady } from '@/lib/server/database';
import { productionReadiness, queueConfigured, redisConfigured } from '@/lib/server/production';
import { kv } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

/** Safe liveness/readiness endpoint for uptime monitors. Never returns secrets. */
export async function GET() {
  const readiness = productionReadiness();
  const required = process.env.NODE_ENV === 'production';
  if (required && !readiness.ready) return json({ ok: false, error: 'Production services are not configured.' }, 503);
  try {
    await kv.get('health:ping');
    const database = databaseReady() ? await databaseHealthy() : false;
    const ok = !required || database;
    const body = {
      ok,
      time: new Date().toISOString(),
      services: { redis: redisConfigured(), database, queue: queueConfigured() },
      ...(required ? {} : { missing: readiness.missing }),
    };
    return json(body, ok ? 200 : 503, { 'Cache-Control': 'no-store' });
  } catch {
    return json({ ok: false, error: 'A required service did not answer.' }, 503);
  }
}
