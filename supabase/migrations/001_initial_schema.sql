-- Jobseek.ai Initial Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  headline text,
  location text,
  target_roles text[] default '{}',
  target_industries text[] default '{}',
  resume_text text,
  candidate_summary text,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── COMPANIES ─────────────────────────────────────────────────────────────────
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  funding_stage text,
  last_round_date date,
  headcount integer,
  headcount_growth text,
  total_funding text,
  investors text[],
  growth_signal text,
  summary text,
  why_fit text,
  hiring_signals text[],
  red_flags text[],
  summary_updated_at timestamptz,
  source text,
  logo_url text,
  website_url text,
  description text,
  created_at timestamptz default now()
);

-- ── PEOPLE ────────────────────────────────────────────────────────────────────
create table public.people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies on delete cascade,
  name text not null,
  title text,
  seniority text,
  linkedin_url text,
  email text,
  photo_url text,
  outreach_priority_score integer default 0,
  cached_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ── OUTREACH DRAFTS ───────────────────────────────────────────────────────────
create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade,
  person_id uuid references public.people on delete cascade,
  company_id uuid references public.companies on delete cascade,
  type text check (type in ('linkedin', 'email')) not null,
  subject text,
  body text not null,
  sent_flag boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- ── PIPELINE ──────────────────────────────────────────────────────────────────
create table public.pipeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade,
  company_id uuid references public.companies on delete cascade,
  person_id uuid references public.people,
  status text check (status in ('saved', 'messaged', 'replied', 'interviewing')) default 'saved',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, company_id)
);

-- ── SEARCH QUERIES ────────────────────────────────────────────────────────────
create table public.search_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade,
  raw_query text,
  processed_intent jsonb,
  result_count integer,
  created_at timestamptz default now()
);

-- ── RLS POLICIES ──────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.pipeline_entries enable row level security;
alter table public.outreach_drafts enable row level security;
alter table public.search_queries enable row level security;
-- Companies and people are shared (no user-specific RLS needed, users can read all)

-- Profiles: own only
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Pipeline: own only
create policy "Users manage own pipeline" on public.pipeline_entries
  for all using (auth.uid() = user_id);

-- Outreach: own only
create policy "Users manage own outreach" on public.outreach_drafts
  for all using (auth.uid() = user_id);

-- Search queries: own only
create policy "Users read own queries" on public.search_queries
  for all using (auth.uid() = user_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger pipeline_updated_at
  before update on public.pipeline_entries
  for each row execute procedure public.handle_updated_at();

-- ── INDEXES ───────────────────────────────────────────────────────────────────
create index companies_domain_idx on public.companies (domain);
create index people_company_id_idx on public.people (company_id);
create index pipeline_user_id_idx on public.pipeline_entries (user_id);
create index outreach_user_id_idx on public.outreach_drafts (user_id);
