-- ─────────────────────────────────────────────────────────────────────────────
-- EchoRoom PostgreSQL Initialization
-- Runs once on first container startup.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DO $$ BEGIN
  RAISE NOTICE 'EchoRoom PostgreSQL extensions initialized';
END $$;
