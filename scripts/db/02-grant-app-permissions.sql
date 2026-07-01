-- Step 2 of 2. Run this AFTER migrations have created the tables
-- (npm run db:migrate), by the same admin/owner connection as step 1.
-- Re-run it any time a new table is added that the app needs to touch.

-- Row-level CRUD only, on exactly the tables the app needs. No DDL rights
-- (no CREATE/ALTER/DROP), so a compromised app process can't change schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.users,
  public.properties,
  public.inquiries,
  public.refresh_tokens,
  public.password_reset_tokens
TO app_user;

-- All tables use UUID primary keys (gen_random_uuid()), not serial/identity
-- columns, so there are no sequences to grant here today. If a future table
-- adds a serial/identity column, also run:
--   GRANT USAGE ON SEQUENCE <sequence_name> TO app_user;
