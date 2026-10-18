-- One-time local dev database setup WITHOUT Docker (native PostgreSQL 16 on Windows).
-- Run as the `postgres` superuser:
--   "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -f infra/local/setup-db.sql
-- Requires PostGIS installed for PostgreSQL 16 (StackBuilder → Spatial Extensions → PostGIS 3.x Bundle).

SELECT 'CREATE ROLE poyalo LOGIN PASSWORD ''poyalo'' CREATEDB'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'poyalo') \gexec

SELECT 'CREATE DATABASE poyalo OWNER poyalo'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'poyalo') \gexec

\connect poyalo

-- Extensions need a superuser, so they are created here; the migration's CREATE EXTENSION IF NOT EXISTS then no-ops.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

SELECT postgis_full_version();
