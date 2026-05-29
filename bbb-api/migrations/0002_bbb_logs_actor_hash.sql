ALTER TABLE bbb_logs ADD COLUMN actor_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_bbb_logs_actor_created_at ON bbb_logs(actor_hash, created_at DESC);
