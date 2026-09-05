-- 001 — `stories` table + RLS
-- First applied 2026-08-16. Re-applied 2026-09-04 after the project's schema came back empty
-- following the free-tier idle pause/restore.
--
-- Safe to re-run: every object is guarded, so this is idempotent and will not 42P07 on a
-- project that already has the table.

-- UP
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        text not null check (mode in ('classic', 'interactive')),
  title       text not null,
  selections  jsonb not null,          -- genre/character/length/readingLevel/tone/lesson
  content     jsonb not null,          -- classic: {story}; interactive: {arc, beats, choices, beatChoices, ended}
  image_url   text,
  progress    real not null default 0,
  time_spent  integer not null default 0,
  opened      boolean not null default false,  -- drives regenerate-replaces-if-unread
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists stories_user_updated_idx on public.stories (user_id, updated_at desc);

alter table public.stories enable row level security;

-- `create policy` has no IF NOT EXISTS before PG15+/`or replace`, so drop-then-create keeps this
-- file re-runnable on any version.
drop policy if exists "own stories: select" on public.stories;
create policy "own stories: select" on public.stories
  for select using (auth.uid() = user_id);

drop policy if exists "own stories: insert" on public.stories;
create policy "own stories: insert" on public.stories
  for insert with check (auth.uid() = user_id);

drop policy if exists "own stories: update" on public.stories;
create policy "own stories: update" on public.stories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own stories: delete" on public.stories;
create policy "own stories: delete" on public.stories
  for delete using (auth.uid() = user_id);

-- DOWN
-- drop table if exists public.stories;
