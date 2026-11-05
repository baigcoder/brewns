import { fail } from './http';
import { kv, withLock } from './store';

const limit = () => Math.max(1, Math.min(100, Number(process.env.AI_MAX_CONCURRENCY || 10) || 10));

/** Shared Redis semaphore: provider quota is protected across all serverless instances. */
export async function withAiCapacity<T>(fn: () => Promise<T>) {
  const allowed = await withLock('ai-capacity', async () => {
    const active = await kv.incr('ai:active', 120);
    if (active <= limit()) return true;
    await kv.decr('ai:active');
    return false;
  });
  if (!allowed) fail(503, 'Sarah is helping other callers right now. Please try again in a moment.');
  try {
    return await fn();
  } finally {
    await kv.decr('ai:active').catch(() => {});
  }
}
