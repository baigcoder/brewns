import { json } from '@/lib/server/http';
import { kv, storeInfo } from '@/lib/server/store';

/**
 * For an uptime monitor (UptimeRobot, Better Stack, Vercel checks): 200 when the site is up and its
 * database answers, 503 when it doesn't. It says nothing about customers, orders or settings.
 */
export async function GET() {
  const started = Date.now();
  try {
    // A real round trip to the store, not just "the server is running".
    await kv.get('health:ping');
    const { kind, ephemeral } = storeInfo();
    return json({ ok: true, store: kind, ephemeral, ms: Date.now() - started });
  } catch {
    return json({ ok: false, error: 'The database did not answer.' }, 503);
  }
}
