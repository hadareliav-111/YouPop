-- Rollback for supabase/keepalive.sql: run in the Supabase SQL Editor to
-- remove the keepalive table. Dropping the table also drops its policy and
-- grants; no other table is affected. Disable or delete the
-- supabase-keepalive GitHub workflow too, or its next run will fail.

drop table if exists public.keepalive;
