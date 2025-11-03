CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  score_band TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_last_activity
  ON users (last_activity_at DESC);
