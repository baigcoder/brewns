-- Run once against Neon before enabling DATABASE_URL in production.
CREATE TABLE IF NOT EXISTS operational_events (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS operational_events_subject_created_idx
  ON operational_events (subject, created_at DESC);
