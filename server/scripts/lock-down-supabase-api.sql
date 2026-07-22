-- Lock the Supabase Data API out of the application database.
--
-- Why: the app reaches Postgres over a direct Prisma connection only — it has never
-- used PostgREST or supabase-js. But Supabase exposes every table in `public` over
-- https://<project>.supabase.co/rest/v1/ to anyone holding the anon key, and without
-- Row-Level Security that means read AND write on customer orders, contact details
-- and the admin password hash. This closes that door without touching the app.
--
-- Safe for Prisma: it connects as the `postgres` role, which has BYPASSRLS, so it is
-- unaffected by the policies below. Verify that before running (see step 1).
--
-- Run in: Supabase dashboard → SQL Editor.

-- ── Step 1: confirm the app's role bypasses RLS ───────────────────────────────
-- Expect rolbypassrls = true. If it is false, STOP — enabling RLS would break the
-- site, and the Data API should be switched off in the dashboard instead.
select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname in ('postgres', 'anon', 'authenticated');

-- ── Step 2: enable RLS on every table in `public` ─────────────────────────────
-- No policies are created, so PostgREST (anon / authenticated) can see nothing.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    -- FORCE also applies RLS to the table owner, so an owner-role leak is contained.
    -- BYPASSRLS roles (postgres, i.e. Prisma) are still exempt, which is what we want.
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- ── Step 3: take the API roles' privileges away entirely ──────────────────────
-- Belt and braces: even if a policy is added by accident later, these roles hold
-- no grants on the schema.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke all on all functions in schema public from anon;
    revoke usage on schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
    alter default privileges in schema public revoke all on sequences from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke all on all functions in schema public from authenticated;
    revoke usage on schema public from authenticated;
    alter default privileges in schema public revoke all on tables from authenticated;
    alter default privileges in schema public revoke all on sequences from authenticated;
  end if;
end $$;

-- ── Step 4: check it worked ───────────────────────────────────────────────────
-- Every row should show rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
