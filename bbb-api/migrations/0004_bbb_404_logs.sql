CREATE TABLE IF NOT EXISTS bbb_404_logs (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  bad_path TEXT NOT NULL,
  referrer TEXT,
  ip_hash TEXT,
  user_agent_short TEXT
);

CREATE INDEX IF NOT EXISTS idx_bbb_404_logs_created_at_desc ON bbb_404_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbb_404_logs_bad_path ON bbb_404_logs(bad_path);
