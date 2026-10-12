-- 004 — `delete_my_account`
--
-- Lets a signed-in user delete their own account (#92, Step 9). Deleting from `auth.users` needs more
-- than the `authenticated` role has, and the alternative - putting the service-role key in the app -
-- would bypass RLS on every path and is exactly what this project has refused to do since day one.
--
-- `security definer` with the target pinned to `auth.uid()`: the caller cannot name whose account to
-- delete, only delete their own. Their `stories` rows go with it via `on delete cascade` (migration
-- 001), though `/api/delete-account` deletes them explicitly first so it can clean up their covers.
--
-- Apply to the dev project first, then live.
--
-- Safe to re-run.

-- UP
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''          -- Supabase security linter: mutable search_path is an escalation vector
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Signed-in users only. `anon` would hit the null check anyway, but there's no reason to let it try.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- DOWN
-- drop function if exists public.delete_my_account();
