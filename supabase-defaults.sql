-- Run this once in Supabase Dashboard → SQL Editor.
-- Adds DB-level defaults so supabase-js inserts don't need to supply id/createdAt/updatedAt.
-- Prisma generated these in client code; without Prisma, Postgres has to do it.

-- gen_random_uuid() ships with the pgcrypto extension; enable it if missing.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE r record;
BEGIN
  -- Set id default to gen_random_uuid()::text on every table whose id column is text
  -- and currently has no default. Cuid and uuid both fit in text, so this is non-destructive.
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'id'
      AND c.data_type = 'text'
      AND c.column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()::text', r.table_name);
  END LOOP;
END $$;

-- createdAt / updatedAt defaults — most tables already have them via Prisma migrations,
-- but set NOW() defaults for safety on any that are missing.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('createdAt', 'updatedAt')
      AND c.column_default IS NULL
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT now()', r.table_name, r.column_name);
  END LOOP;
END $$;
