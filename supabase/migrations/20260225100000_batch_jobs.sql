-- Persistent batch job state so admin batch processes survive page navigation
CREATE TABLE IF NOT EXISTS batch_jobs (
  job_id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('assign_demand_groups', 'reclassify')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  country TEXT,
  current_batch INTEGER NOT NULL DEFAULT 0,
  total_processed INTEGER NOT NULL DEFAULT 0,
  total_updated INTEGER NOT NULL DEFAULT 0,
  total_remaining INTEGER,
  log_lines TEXT[] NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_jobs_all" ON batch_jobs FOR ALL USING (true) WITH CHECK (true);
