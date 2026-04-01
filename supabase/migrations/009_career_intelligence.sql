-- ─────────────────────────────────────────────────
-- CANDIDATE MODEL
-- The structured understanding of a candidate,
-- built from the Career Intake conversation.
-- ─────────────────────────────────────────────────
create table if not exists candidate_models (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade not null unique,

  -- Identity
  headline            text,
  positioning         text,
  bio_short           text,
  bio_long            text,
  location            text,

  -- Structured experience
  work_experiences    jsonb default '[]'::jsonb,
  projects            jsonb default '[]'::jsonb,
  education           jsonb default '[]'::jsonb,
  writing_links       jsonb default '[]'::jsonb,

  -- Matching signals
  skill_tags          text[] default '{}',
  domain_expertise    text[] default '{}',
  stage_fit           text[] default '{}',
  target_roles        text[] default '{}',
  hard_nos            text[] default '{}',
  preferred_culture   text[] default '{}',

  -- Derived outputs (auto-generated after intake)
  linkedin_headline   text,
  resume_bullets      jsonb default '[]'::jsonb,
  unique_pov          text,

  -- Intake state
  intake_phase        int default 0,
  completeness_score  int default 0,
  conversation_id     uuid,
  last_updated        timestamptz default now(),
  created_at          timestamptz default now()
);

alter table candidate_models enable row level security;
create policy "Users manage own model" on candidate_models
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- INTAKE CONVERSATIONS
-- Full transcript of the career interview.
-- ─────────────────────────────────────────────────
create table if not exists intake_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  messages    jsonb default '[]'::jsonb,
  phase       int default 1,
  is_complete boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table intake_conversations enable row level security;
create policy "Users manage own conversations" on intake_conversations
  for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- PUBLIC PROFILES
-- Controls the public-facing profile page.
-- ─────────────────────────────────────────────────
alter table profiles
  add column if not exists slug             text unique,
  add column if not exists is_profile_public boolean default false,
  add column if not exists profile_theme    text default 'light',
  add column if not exists custom_domain    text,
  add column if not exists twitter_url      text,
  add column if not exists github_url       text,
  add column if not exists website_url      text;

-- Auto-generate slug from name on insert
create or replace function generate_profile_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter int := 0;
begin
  base_slug := lower(regexp_replace(coalesce(new.name, split_part(new.email, '@', 1)), '[^a-z0-9]', '-', 'g'));
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  while exists (select 1 from profiles where slug = final_slug and id != new.id) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;
  new.slug := final_slug;
  return new;
end;
$$ language plpgsql;

create or replace trigger set_profile_slug
  before insert on profiles
  for each row
  when (new.slug is null)
  execute function generate_profile_slug();

-- ─────────────────────────────────────────────────
-- ENGAGEMENT OPPORTUNITIES
-- Posts from LinkedIn feed worth commenting on.
-- ─────────────────────────────────────────────────
create table if not exists engagement_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade not null,
  post_id             text not null,
  author_name         text,
  author_title        text,
  author_company      text,
  author_linkedin_url text,
  post_text           text,
  post_url            text,
  engagement_score    int default 0,
  score_reasons       text[] default '{}',
  suggested_angle     text,
  generated_comment   text,
  status              text default 'pending',
  captured_at         timestamptz default now(),
  created_at          timestamptz default now()
);

create unique index on engagement_opportunities(user_id, post_id);
alter table engagement_opportunities enable row level security;
create policy "Users manage own opportunities" on engagement_opportunities
  for all using (auth.uid() = user_id);
