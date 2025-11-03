CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  action_type TEXT,
  disclosure_version TEXT,
  scoped_fields_snapshot JSONB,
  success BOOLEAN,
  amount_saved_usd NUMERIC,
  notes TEXT,
  ip_trunc TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id_created_at
  ON events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_type
  ON events (type);
