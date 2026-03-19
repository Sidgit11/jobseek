-- Add Crunchbase enrichment timestamp to companies table
-- Used to implement 48h DB-level cache (skip API if data is fresh)
alter table public.companies
  add column if not exists cb_enriched_at timestamptz;
