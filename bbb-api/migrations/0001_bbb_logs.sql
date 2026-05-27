CREATE TABLE IF NOT EXISTS bbb_logs (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  origin TEXT,
  pathname TEXT,
  search TEXT,
  ip_hash TEXT,
  model TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  user_prompt TEXT,
  assistant_reply TEXT,
  error_message TEXT,
  message_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bbb_logs_created_at ON bbb_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbb_logs_status_created_at ON bbb_logs(status, created_at DESC);
