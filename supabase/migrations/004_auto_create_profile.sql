-- Migration 004: Auto-create profile row when a new auth user signs up
-- Fixes FK violation on pipeline_entries, outreach_drafts, search_queries

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop trigger if it already exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also backfill any existing auth users who don't have a profile yet
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
