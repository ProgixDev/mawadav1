-- empty_database.sql
-- ⚠️ Empties ALL data in the app (public-schema rows + auth users).
-- Tables and structure are KEPT. This operation is IRREVERSIBLE.
-- Run in the Supabase SQL Editor for the dating app project (ref: bnsupcvjwyxqofasjxcg).

-- 1) Empty every table in the public schema (rows only, structure preserved).
--    RESTART IDENTITY resets auto-increment counters; CASCADE handles FK order.
DO $$
DECLARE
  stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE '
       || string_agg(format('%I.%I', schemaname, tablename), ', ')
       || ' RESTART IDENTITY CASCADE'
  INTO stmt
  FROM pg_tables
  WHERE schemaname = 'public';

  IF stmt IS NOT NULL THEN
    EXECUTE stmt;
  END IF;
END $$;

-- 2) Delete all authentication users (Supabase Auth).
--    Cascades to identities, sessions, refresh tokens, etc.
DELETE FROM auth.users;
