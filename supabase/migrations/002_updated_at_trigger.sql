-- 002 — `updated_at` trigger
--
-- `default now()` fires on INSERT only; Postgres never touches `updated_at` on UPDATE. The
-- eviction rule ("the story being read is structurally never the oldest") depends on this column
-- actually moving, so it is enforced in the database rather than left to every caller in
-- `lib/stories.ts`.
--
-- Safe to re-run.

-- UP
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''          -- Supabase security linter: mutable search_path is an escalation vector
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stories_set_updated_at on public.stories;
create trigger stories_set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

-- DOWN
-- drop trigger if exists stories_set_updated_at on public.stories;
-- drop function if exists public.set_updated_at();
