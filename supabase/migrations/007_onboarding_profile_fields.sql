-- Add new profile fields for personalized onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seniority TEXT,                        -- 'entry' | 'mid' | 'senior' | 'lead'
  ADD COLUMN IF NOT EXISTS target_locations TEXT[] DEFAULT '{}',  -- ['India', 'US', 'Europe', 'Remote']
  ADD COLUMN IF NOT EXISTS company_stages TEXT[] DEFAULT '{}',    -- ['Startup', 'Growth', 'Enterprise']
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_headline TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_experience JSONB;             -- [{company, title, duration}]
