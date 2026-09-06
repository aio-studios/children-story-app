-- Two-user RLS check for public.stories  (#92, Step 3's last open item)
--
-- WHY THIS EXISTS
-- The anonymous check (SELECT -> [], INSERT -> 42501) only proves RLS is *on*. It does not prove the
-- policies are *correct*: a policy of `using (true)` passes the anonymous test and still leaks every
-- user's library to every other user. Only two real signed-in users can tell those two apart.
--
-- HOW TO RUN
-- Supabase dashboard -> SQL Editor -> paste this whole file -> Run, and choose to run it WITHOUT
-- RLS. That is not a contradiction: the script must start as the table owner to plant a row for each
-- user, then switches role to `authenticated` itself to do the actual testing. Read the table it
-- returns; every row must say PASS. Needs two rows in auth.users, and says so plainly if there are
-- fewer.
--
-- Every measurement is taken into a variable while role-switched and only written to the results
-- table after `reset role`. The results table is owned by postgres, and `authenticated` deliberately
-- has no privileges on it - the role under test should not be able to write to the scoreboard.
--
-- SAFE TO RE-RUN, and it leaves nothing behind. It seeds two throwaway rows and deletes them on the
-- way out; if anything raises, the whole DO block is one statement and Postgres rolls the seed rows
-- back for us. A failed *policy* records itself as a FAIL row rather than raising, so the results
-- table survives to name the broken one. Re-run after ANY change to the policies.

drop table if exists rls_check;
create temp table rls_check (ord int, step text, expected text, actual text, pass boolean);

do $$
declare
  user_a uuid; user_b uuid;
  row_a  uuid; row_b  uuid;
  claims_a text; claims_b text;
  -- Measurements, all taken while role-switched.
  a_visible int; a_sees_b int;
  b_visible int; b_sees_a int;
  b_updated int; b_deleted int;
  b_forged  boolean;
  survived  int;
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
  -- Claims are set before the role switch: they are set while still postgres and the switch
  -- inherits them.
  execute format('set local request.jwt.claims = %L', claims_a);
  execute 'set local role authenticated';

  select count(*) into a_visible from public.stories where id in (row_a, row_b);
  select count(*) into a_sees_b  from public.stories where id = row_b;

  -- ---- READ as user B ----
  execute 'reset role';
  execute format('set local request.jwt.claims = %L', claims_b);
  execute 'set local role authenticated';

  select count(*) into b_visible from public.stories where id in (row_a, row_b);
  select count(*) into b_sees_a  from public.stories where id = row_a;

  -- ---- WRITE as user B, against A's row ----
  -- A silent no-op is the correct outcome: the USING clause filters the row out before the write,
  -- so these report 0 rows affected rather than raising.
  update public.stories set title = 'HIJACKED' where id = row_a;
  get diagnostics b_updated = row_count;

  delete from public.stories where id = row_a;
  get diagnostics b_deleted = row_count;

  -- Forging a row owned by A DOES raise 42501: a WITH CHECK violation has no row to filter out.
  -- Catching it rolls back to the start of this inner block, where the role was already
  -- `authenticated`, so the role switch survives.
  begin
    insert into public.stories (user_id, mode, title, selections, content)
    values (user_a, 'classic', 'FORGED', '{}'::jsonb, '{}'::jsonb);
    b_forged := true;
  exception when insufficient_privilege then
    b_forged := false;
  end;

  -- ---- Back to the owner: record everything, prove nothing above landed ----
  execute 'reset role';

  select count(*) into survived
  from public.stories where id in (row_a, row_b) and title like 'RLS check%';

  insert into rls_check values
    (1, 'A reads: sees only its own row',            '1', a_visible::text, a_visible = 1),
    (2, 'A reads: cannot see B''s row',              '0', a_sees_b::text,  a_sees_b  = 0),
    (3, 'B reads: sees only its own row',            '1', b_visible::text, b_visible = 1),
    (4, 'B reads: cannot see A''s row',              '0', b_sees_a::text,  b_sees_a  = 0),
    (5, 'B writes: cannot update A''s row',          '0 rows', b_updated::text || ' rows', b_updated = 0),
    (6, 'B writes: cannot delete A''s row',          '0 rows', b_deleted::text || ' rows', b_deleted = 0),
    (7, 'B writes: cannot insert a row owned by A',  'blocked',
        case when b_forged then 'INSERT SUCCEEDED' else 'blocked (42501)' end, not b_forged),
    (8, 'Owner: both seed rows survived untouched',  '2', survived::text,  survived  = 2);

  delete from public.stories where id in (row_a, row_b);

  -- If the forge SUCCEEDED the policy is broken AND a bogus row is now sitting in a real user's
  -- library. That is precisely the run where cleanup matters most, so it happens here rather than
  -- being left to whoever reads the FAIL. Scoped to this probe's exact title and owner.
  if b_forged then
    delete from public.stories where user_id = user_a and title = 'FORGED';
  end if;
end $$;

select
  case when pass then 'PASS' else 'FAIL' end as result,
  step, expected, actual
from rls_check
order by pass, ord;
