-- Step 1 of 2. Creates the least-privilege role itself. Safe to run before
-- any tables exist — this only touches the role and database-level grants.
--
-- Run this ONCE, by an admin/owner-level connection, against the target
-- database. For local Docker Postgres this runs automatically on first
-- container init (see docker-compose.yml). For staging/production, a human
-- with admin access runs this by hand — the app itself must never hold
-- permissions to create roles or grants.
--
-- Change app_user's password below before running this against anything
-- other than local Docker Postgres, and put the real password only in that
-- environment's DATABASE_URL secret, never in this file.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_dev_password';
  END IF;
END
$$;

-- Scope the role to this one database.
GRANT CONNECT ON DATABASE app_dev TO app_user;
REVOKE ALL ON DATABASE app_dev FROM PUBLIC;

-- NOTE ON OTHER DATABASES ON THE SAME INSTANCE: Postgres grants CONNECT to
-- PUBLIC on every database by default. This script only revokes that on
-- app_dev. If this instance hosts other databases, run
-- `REVOKE ALL ON DATABASE <that_db> FROM PUBLIC;` against each of them too
-- (as an admin, once) — otherwise app_user can still connect to them by
-- virtue of the default PUBLIC grant, not because of anything granted here.

-- Let it see objects in the schema, but not create/alter/drop anything in it.
GRANT USAGE ON SCHEMA public TO app_user;

-- Deliberately not granted, and should stay that way:
--   - CREATEDB / CREATEROLE / SUPERUSER
--   - Membership in any role that has those
--   - CREATE on the schema, or ownership of any table
--   - Access to any database other than the one above
