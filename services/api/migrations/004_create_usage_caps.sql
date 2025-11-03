CREATE TABLE IF NOT EXISTS usage_caps (
  user_id TEXT NOT NULL,
  usage_date DATE NOT NULL,
  analyses_used INTEGER NOT NULL DEFAULT 0,
  scripts_used INTEGER NOT NULL DEFAULT 0,
  exports_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
