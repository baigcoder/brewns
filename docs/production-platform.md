# Production platform runbook

## Required services

1. **Upstash Redis** in the closest available region. Set `KV_REST_API_URL` and
   `KV_REST_API_TOKEN`. Production intentionally refuses the file-store fallback.
2. **Neon Postgres**. Set `DATABASE_URL`, then run `db/migrations/001_production.sql`
   in Neon SQL Editor. It stores an append-only operational ledger for orders,
   reservations and failed background jobs.
3. **Upstash QStash**. Set `QSTASH_TOKEN`, `QSTASH_URL`,
   `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY`. It retries
   booking email and WhatsApp jobs outside the customer request. On Preview,
   also set `JOB_CALLBACK_URL` to the preview/staging URL; it prevents test jobs
   from being sent to production.
4. **Sentry**. Set `SENTRY_DSN` to capture server and Edge exceptions without
   customer personal data.

## Readiness check

After deployment, request `/api/health`. In production it returns `200` only
when Redis, Neon, QStash and a 32-character `SESSION_SECRET` are configured.

## Capacity validation

Run the read-only test against a preview or a dedicated staging deployment:

```sh
BASE_URL=https://your-preview.vercel.app k6 run load/staging-100.js
```

It ramps to 100 concurrent users (70 browsing, 20 public API, 10 readiness).
Pass only when p95 is below 2 seconds, error rate below 1%, and `/api/health`
stays ready. Test authenticated order/booking and AI scenarios only with a
dedicated test shop, test accounts, and provider sandbox keys.

## AI capacity

`AI_MAX_CONCURRENCY` is a Redis-backed ceiling shared by every Vercel instance.
Start at `10`; increase only after observing Groq/Gemini/ElevenLabs quotas,
latency, and error rates in staging. Excess turns return a safe `503` instead
of exhausting the provider account.
