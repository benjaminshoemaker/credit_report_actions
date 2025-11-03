CREATE TABLE IF NOT EXISTS saved_items (
  item_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  template_id TEXT NOT NULL,
  payload_no_pii JSONB NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_items_user_id
  ON saved_items (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_items_engine_version
  ON saved_items (engine_version);
