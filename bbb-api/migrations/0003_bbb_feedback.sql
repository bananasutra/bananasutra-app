CREATE TABLE IF NOT EXISTS bbb_feedback (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  request_id TEXT,
  intent_type TEXT NOT NULL,
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  pathname TEXT,
  search TEXT,
  conversation_tail TEXT,
  delivery_status TEXT NOT NULL,
  delivery_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_bbb_feedback_created_at_desc ON bbb_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbb_feedback_intent_created_at ON bbb_feedback(intent_type, created_at DESC);
