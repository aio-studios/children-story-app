-- Two-user RLS check for public.stories  (#92, Step 3's last open item)
--
-- WHY THIS EXISTS
-- The anonymous check (SELECT -> [], INSERT -> 42501) only proves RLS is *on*. It does not prove the
-- policies are *correct*: a policy of `using (true)` passes the anonymous test and still leaks every
-- user's library to every other user. Only two real signed-in users can tell those two apart.
--
-- HOW TO RUN
-- Supabase dashboard -> SQL Editor -> paste this whole file -> Run. Read the table it returns; every
-- row must say PASS. Needs two rows in auth.users, and says so plainly if there are fewer.
--
-- SAFE TO RE-RUN, and it leaves nothing behind. It seeds two throwaway rows and deletes them on the
-- way out; if anything raises, the whole DO block is one statement and Postgres rolls the seed rows
-- back for us. A failed *policy* records itself as a FAIL row rather than raising, so the results
-- table survives to tell you which one broke. Re-run after ANY change to the policies.

drop table if exists rls_check;
create temp table rls_check (ord int, step text, expected text, actual text, pass boolean);

do $$
declare
  user_a uuid; user_b uuid;
  row_a  uuid; row_b  uuid;
  n int;
  claims_a text; claims_b text;
begin
  -- Two real users, ordered so repeat runs pick the same pair.
  select id into user_a from auth.users order by created_at, id limit 1;
  select id into user_b from auth.users where id <> user_a order by created_at, id limit 1;

  if user_a is null or user_b is null then
    raise exception
      'Need two users in auth.users, found %. Add one via Authentication -> Users -> Add user, then re-run.',
      (select count(*) from auth.users);
  end if;

  claims_a := json_build_object('sub', user_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', user_b, 'role', 'authenticated')::text;

  -- Seed one row per user as the table owner. RLS does not apply to the owner, which is the point:
  -- this is setup, not part of what is being tested.
  insert into public.stories (user_id, mode, title, selections, content)
  values (user_a, 'classic', 'RLS check - A''s story', '{}'::jsonb, '{}'::jsonb)
  returning id into row_a;

  insert into public.stories (user_id, mode, title, selections, content)
  values (user_b, 'classic', 'RLS check - B''s story', '{}'::jsonb, '{}'::jsonb)
  returning id into row_b;

  -- ---- READ as user A ----
  -- Claims are set before the role switch: `authenticated` is not the owner of these GUCs, so set
  -- them while still postgres and let the switch inherit them.
  execute format('set local request.jwt.claims = %L', claims_a);
  execute 'set local role authenticated';

  select count(*) into n from public.stories where id in (row_a, row_b);
  insert into rls_check values (1, 'A reads: sees only its own row', '1', n::text, n = 1);

  select count(*) into n from public.stories where id = row_b;
  insert into rls_check values (2, 'A reads: cannot see B''s row', '0', n::text, n = 0);

  -- ---- READ as user B ----
  execute 'reset role';
  execute format('set local request.jwt.claims = %L', claims_b);
  execute 'set local role authenticated';

  select count(*) into n from public.stories where id in (row_a, row_b);
  insert into rls_check values (3, 'B reads: sees only its own row', '1', n::text, n = 1);

  select count(*) into n from public.stories where id = row_a;
  insert into rls_check values (4, 'B reads: cannot see A''s row', '0', n::text, n = 0);

  -- ---- WRITE as user B, against A's row ----
  -- A silent no-op is the correct outcome: the USING clause filters the row out before the write,
  -- so these report 0 rows affected rather than raising.
  update public.stories set title = 'HIJACKED' where id = row_a;
  get diagnostics n = row_count;
  insert into rls_check values (5, 'B writes: cannot update A''s row', '0', n::text, n = 0);

  delete from public.stories where id = row_a;
  get diagnostics n = row_count;
  insert into rls_check values (6, 'B writes: cannot delete A''s row', '0', n::text, n = 0);

  -- Forging a row owned by A DOES raise 42501: a WITH CHECK violation has no row to filter out.
  begin
    insert into public.stories (user_id, mode, title, selections, content)
    values (user_a, 'classic', 'FORGED', '{}'::jsonb, '{}'::jsonb);
    insert into rls_check values (7, 'B writes: cannot insert a row owned by A', '42501 raised', 'insert succeeded', false);
  exception when insufficient_privilege then
    insert into rls_check values (7, 'B writes: cannot insert a row owned by A', '42501 raised', '42501 raised', true);
  end;

  -- ---- Back to the owner: prove nothing above actually landed ----
  execute 'reset role';

  select count(*) into n from public.stories where id in (row_a, row_b) and title like 'RLS check%';
  insert into rls_check values (8, 'Owner: both seed rows survived untouched', '2', n::text, n = 2);

  delete from public.stories where id in (row_a, row_b);
end $$;

select
  case when pass then 'PASS' else 'FAIL' end as result,
  step, expected, actual
from rls_check
order by pass, ord;
