-- Scan session metrics — tracks the full pipeline funnel per scan
CREATE TABLE IF NOT EXISTS public.scan_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token TEXT NOT NULL,
  session_id TEXT NOT NULL,              -- unique per scan run (timestamp-based)
  source TEXT NOT NULL DEFAULT 'FEED',   -- FEED, JOBS, FEED_JOBS_WIDGET
  posts_extracted INT DEFAULT 0,         -- total posts found by DOM extractors
  posts_after_prefilter INT DEFAULT 0,   -- posts that passed local prefilter
  posts_after_dedup INT DEFAULT 0,       -- posts after removing duplicates + already-seen
  posts_sent_to_gemini INT DEFAULT 0,    -- posts actually sent to classify API
  posts_approved INT DEFAULT 0,          -- signals returned by Gemini
  posts_rejected INT DEFAULT 0,          -- posts Gemini said "not a signal"
  job_posts_direct INT DEFAULT 0,        -- job listings direct-stored (bypassed Gemini)
  rejection_samples JSONB DEFAULT '[]',  -- [{author, body_preview, reason}] top 5 rejected
  approval_samples JSONB DEFAULT '[]',   -- [{author, type, company, confidence}] approved signals
  gemini_latency_ms INT,                 -- how long Gemini took
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_metrics_device ON scan_metrics(device_token);
CREATE INDEX IF NOT EXISTS idx_scan_metrics_created ON scan_metrics(created_at DESC);

-- RLS: anyone can insert (extension uses anon key), read filtered by device_token
ALTER TABLE public.scan_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_metrics_insert" ON public.scan_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "scan_metrics_select" ON public.scan_metrics
  FOR SELECT USING (true);
