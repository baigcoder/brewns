/** Runtime safeguards for the services that make a multi-instance deployment safe. */

export const isProduction = () => process.env.NODE_ENV === 'production';

export const redisConfigured = () => Boolean(
  (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
);

export const databaseConfigured = () => Boolean(process.env.DATABASE_URL);
export const queueConfigured = () => Boolean(process.env.QSTASH_TOKEN && process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY);

export function productionReadiness() {
  const missing: string[] = [];
  if (!redisConfigured()) missing.push('KV_REST_API_URL and KV_REST_API_TOKEN');
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) missing.push('SESSION_SECRET (32+ characters)');
  if (!databaseConfigured()) missing.push('DATABASE_URL');
  if (!queueConfigured()) missing.push('QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, and QSTASH_NEXT_SIGNING_KEY');
  return { ready: !missing.length, missing };
}

/** Redis coordinates locks, rate limits and sessions across Vercel instances.
 * A production request must never silently use the ephemeral file fallback. */
export function requireProductionRedis() {
  if (isProduction() && !redisConfigured()) throw new Error('Production Redis is not configured.');
}

export function requireProductionSessionSecret() {
  if (isProduction() && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production.');
  }
}
