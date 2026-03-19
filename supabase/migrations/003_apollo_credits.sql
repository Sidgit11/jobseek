-- Migration 003: Apollo integration
-- Adds apollo_id to people table (for precise enrichment lookups)
-- Adds email_credits to profiles (tracks remaining "Get Email" quota)

-- Store Apollo's internal person ID — needed for accurate enrichment calls
alter table public.people
  add column if not exists apollo_id text;

-- Email enrichment credits per user (50 default = comfortable for trial)
alter table public.profiles
  add column if not exists email_credits integer not null default 50;

-- Index for apollo_id lookups
create index if not exists people_apollo_id_idx on public.people (apollo_id);

-- Atomic credit decrement function (prevents race conditions)
create or replace function public.decrement_email_credits(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_credits integer;
begin
  update public.profiles
  set email_credits = greatest(email_credits - 1, 0)
  where id = p_user_id
    and email_credits > 0
  returning email_credits into new_credits;

  if not found then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  return new_credits;
end;
$$;
