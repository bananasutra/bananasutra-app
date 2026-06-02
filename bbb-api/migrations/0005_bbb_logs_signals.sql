ALTER TABLE bbb_logs ADD COLUMN page_type TEXT;
ALTER TABLE bbb_logs ADD COLUMN intent_json TEXT;

CREATE INDEX IF NOT EXISTS idx_bbb_logs_page_type_created_at ON bbb_logs(page_type, created_at DESC);
