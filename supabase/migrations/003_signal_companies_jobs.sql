-- ============================================================================
-- Migration 003: Signal Companies + Signal Jobs tables
-- Purpose: Materialize company and job entities from linkedin_signals
--          to enable the Jobs → Companies → People → Outreach pipeline
-- ============================================================================

-- ── signal_companies ────────────────────────────────────────────────────────
-- Companies detected via LinkedIn signals (hiring posts, job listings, feed widgets).
-- Bridges the signals world to the existing companies/people/outreach pipeline.

CREATE TABLE IF NOT EXISTS signal_companies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token  TEXT NOT NULL,                          -- scoped to extension user
  name          TEXT NOT NULL,                          -- normalized company name
  name_lower    TEXT NOT NULL,                          -- lowercase for dedup grouping
  domain        TEXT,                                   -- website domain (if resolved)
  linkedin_url  TEXT,                                   -- company LinkedIn page
  logo_url      TEXT,

  -- Enrichment (populated async after detection)
  headcount     INT,
  funding_stage TEXT,
  description   TEXT,
  industry      TEXT,
  location      TEXT,

  -- Link to existing companies table (set when domain is resolved)
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Aggregated stats (updated on each scan)
  signal_count  INT DEFAULT 0,
  role_count    INT DEFAULT 0,
  latest_signal_at TIMESTAMPTZ,
  highest_confidence INT DEFAULT 0,
  sources       TEXT[] DEFAULT '{}',                    -- e.g. {'FEED','JOBS','FEED_JOBS_WIDGET'}

  -- Metadata
  status        TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'saved', 'exploring', 'applied', 'archived')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  -- One company per user per normalized name
  UNIQUE (device_token, name_lower)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_signal_companies_token ON signal_companies(device_token);
CREATE INDEX IF NOT EXISTS idx_signal_companies_status ON signal_companies(device_token, status);
CREATE INDEX IF NOT EXISTS idx_signal_companies_company_id ON signal_companies(company_id);

-- ── signal_jobs ─────────────────────────────────────────────────────────────
-- Individual job roles detected from signals. Many jobs → one signal_company.
-- Tracks the full lifecycle: detected → saved → applied → interviewing → offer/rejected

CREATE TABLE IF NOT EXISTS signal_jobs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token      TEXT NOT NULL,
  signal_company_id UUID NOT NULL REFERENCES signal_companies(id) ON DELETE CASCADE,

  -- Job details
  title             TEXT NOT NULL,                      -- e.g. "Senior Frontend Engineer"
  title_lower       TEXT NOT NULL,                      -- lowercase for dedup
  seniority         TEXT,                               -- parsed: junior/mid/senior/lead/director/vp/c-level
  department        TEXT,                               -- parsed: engineering/product/design/marketing/sales/ops
  location          TEXT,
  salary_range      TEXT,
  job_url           TEXT,                               -- LinkedIn /jobs/view/xxx link

  -- Source tracking
  source            TEXT NOT NULL,                      -- FEED, JOBS, FEED_JOBS_WIDGET, NOTIFICATIONS
  signal_id         TEXT,                               -- FK to linkedin_signals.id (TEXT not UUID)
  detected_at       TIMESTAMPTZ DEFAULT now(),
  confidence        INT DEFAULT 0,

  -- Poster info (for hiring posts)
  poster_name       TEXT,                               -- who posted the hiring announcement
  poster_title      TEXT,
  poster_linkedin   TEXT,

  -- Lifecycle
  status            TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  notes             TEXT,

  -- Metadata
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  -- One job per company per normalized title per source
  UNIQUE (signal_company_id, title_lower, source)
);

CREATE INDEX IF NOT EXISTS idx_signal_jobs_token ON signal_jobs(device_token);
CREATE INDEX IF NOT EXISTS idx_signal_jobs_company ON signal_jobs(signal_company_id);
CREATE INDEX IF NOT EXISTS idx_signal_jobs_status ON signal_jobs(device_token, status);

-- ── signal_company_contacts ─────────────────────────────────────────────────
-- Relevant people at signal companies (e.g. hiring managers, founders, EMs).
-- Bridges signal_companies to the existing people table or stores standalone.

CREATE TABLE IF NOT EXISTS signal_company_contacts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token      TEXT NOT NULL,
  signal_company_id UUID NOT NULL REFERENCES signal_companies(id) ON DELETE CASCADE,

  -- Contact info
  name              TEXT NOT NULL,
  title             TEXT,
  seniority         TEXT,                               -- Founder/C-Level, VP, Director, Head, Manager, Senior, Junior
  linkedin_url      TEXT,
  email             TEXT,
  email_confidence  INT,

  -- How we found them
  discovery_source  TEXT NOT NULL DEFAULT 'signal',     -- signal (from LinkedIn post), hunter, apollo, manual
  signal_id         TEXT,                               -- if discovered from a signal
  person_id         UUID REFERENCES people(id) ON DELETE SET NULL,  -- link to existing people table

  -- Relevance
  relevance_score   INT DEFAULT 0,                      -- 0-100, how relevant to user's job search
  relevance_reason  TEXT,                               -- why this person matters (e.g. "Hiring manager for the Senior FE role")

  -- Outreach tracking
  outreach_status   TEXT DEFAULT 'none' CHECK (outreach_status IN ('none', 'drafted', 'sent', 'replied', 'connected')),
  outreach_draft_id UUID,

  -- Metadata
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE (signal_company_id, linkedin_url)
);

CREATE INDEX IF NOT EXISTS idx_signal_contacts_company ON signal_company_contacts(signal_company_id);
CREATE INDEX IF NOT EXISTS idx_signal_contacts_token ON signal_company_contacts(device_token);

-- ── Updated at trigger ──────────────────────────────────────────────────────
-- Auto-update `updated_at` on row changes

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- signal_companies
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_signal_companies_updated_at') THEN
    CREATE TRIGGER trg_signal_companies_updated_at
      BEFORE UPDATE ON signal_companies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- signal_jobs
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_signal_jobs_updated_at') THEN
    CREATE TRIGGER trg_signal_jobs_updated_at
      BEFORE UPDATE ON signal_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- signal_company_contacts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_signal_contacts_updated_at') THEN
    CREATE TRIGGER trg_signal_contacts_updated_at
      BEFORE UPDATE ON signal_company_contacts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ── RLS policies ────────────────────────────────────────────────────────────
-- For now, allow anon access (device_token scoping provides isolation)

ALTER TABLE signal_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_company_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON signal_companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON signal_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON signal_company_contacts FOR ALL USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
