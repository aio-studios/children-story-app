-- 003 — `cover_is_referenced`
--
-- `/api/delete-illustration` deletes a Blob, and it cannot stay an open endpoint that deletes
-- whatever URL it is handed. Covers belong to saved stories now (#92, Step 5), so one bad request
-- would leave a child's story with a permanently broken image.
--
-- Ownership turns out to be the wrong question. The real invariant is "is this Blob still referenced
-- by ANY story row?" — a cover must outlive every row that points at it, whoever owns them — and it
-- gives the same correct answer for a guest (who has no rows at all) and for a signed-in user. The
-- route refuses the delete whenever this returns true.
--
-- `security definer` because RLS makes a plain count unable to tell "referenced by someone else"
-- (must refuse) from "referenced by nobody" (safe to delete): both come back as zero rows. It
-- returns one boolean and nothing else, and a caller must already hold an unguessable random-UUID
-- Blob URL to learn even that.
--
-- Safe to re-run.

-- UP
create or replace function public.cover_is_referenced(cover_url text)
returns boolean
language sql
stable
security definer
set search_path = ''          -- Supabase security linter: mutable search_path is an escalation vector
as $$
  select exists (select 1 from public.stories where image_url = cover_url);
$$;

-- The function runs on every cover deletion and scans across all users' rows, not just the caller's
-- twenty, so it does not stay a cheap sequential scan as the table grows.
create index if not exists stories_image_url_idx
  on public.stories (image_url)
  where image_url is not null;

-- Callable by signed-out users too: a guest orphans covers exactly like a signed-in user does.
revoke all on function public.cover_is_referenced(text) from public;
grant execute on function public.cover_is_referenced(text) to anon, authenticated;

-- DOWN
-- drop function if exists public.cover_is_referenced(text);
-- drop index if exists public.stories_image_url_idx;
