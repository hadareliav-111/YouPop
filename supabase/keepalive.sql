-- Keepalive table: run this once in the Supabase SQL Editor.
-- Free-tier Supabase projects are paused after a stretch of inactivity. The
-- GitHub Action in .github/workflows/supabase-keepalive.yml reads the single
-- row below every few days so the project always sees recent API traffic.
--
-- The table holds no user data — just one fixed row — and is the ONLY thing
-- this file opens up: the anon role gets SELECT on this table alone. Nothing
-- here touches the grants or policies of any other table.
-- Undo with supabase/keepalive_rollback.sql.

create table public.keepalive (
  id smallint primary key check (id = 1),
  note text not null
);

insert into public.keepalive (id, note) values (1, 'ok');

alter table public.keepalive enable row level security;

-- Supabase's default privileges give anon/authenticated full table access on
-- new public tables (RLS is what normally limits them). Strip that back so
-- even a future permissive policy can't make this table writable, then grant
-- anon read access only.
revoke all on table public.keepalive from anon, authenticated;
grant select on table public.keepalive to anon;

create policy "Anon can read the keepalive row"
  on public.keepalive for select
  to anon
  using (true);
