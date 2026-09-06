-- V2 foundation schema: run this once in the Supabase SQL Editor.
-- See the project's plan/notes for the full rationale. Two tables, both
-- locked to auth.uid() via Row Level Security — no public read/write access.

-- ---------- profiles ----------
-- One row per account, auto-created by the trigger below whenever a user is
-- added in Authentication > Users. `username` is derived from the email's
-- local-part (e.g. "noa@watchlist.local" -> "noa") — the app never shows or
-- collects a real email, this is purely an internal Supabase Auth detail.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- watchlist_items ----------
-- One row per WatchlistItem (src/types/index.ts), owned by exactly one user.
create table public.watchlist_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  external_source text not null check (external_source in ('tvmaze','omdb','mock-movie')),
  title text not null,
  media_type text not null check (media_type in ('movie','tv')),
  tv_subtype text check (tv_subtype in ('scripted','reality')),
  release_year integer,
  release_date date,
  poster_url text,
  genres text[] not null default '{}',
  overview text not null default '',
  external_rating real,
  external_ratings jsonb not null default '[]',
  number_of_seasons integer,
  status text not null check (status in ('want_to_watch','currently_watching','watched')),
  personal_rating integer,
  current_episode jsonb,
  is_recommendation boolean not null default false,
  recommended_by text,
  recommendation_note text,
  personal_notes text,
  personal_tags text[] not null default '{}',
  sort_order integer not null default 0,
  date_added timestamptz not null default now(),
  date_watched timestamptz
);

create index watchlist_items_user_id_idx on public.watchlist_items(user_id);
alter table public.watchlist_items enable row level security;

create policy "Users can view their own items"
  on public.watchlist_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own items"
  on public.watchlist_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on public.watchlist_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own items"
  on public.watchlist_items for delete
  using (auth.uid() = user_id);

-- ---------- recommendations ----------
-- A user's own separate, private, ordered list of titles they want to
-- recommend to others — distinct from watchlist_items' isRecommendation/
-- recommended_by/recommendation_note fields (which record "someone
-- recommended *this to me*"). Deliberately excludes personal rating, tags,
-- watch status, and episode tracking — this is not a filtered view of the
-- watchlist, it's its own collection with just a note.
create table public.recommendations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  external_source text not null check (external_source in ('tvmaze','omdb','mock-movie')),
  media_type text not null check (media_type in ('movie','tv')),
  tv_subtype text check (tv_subtype in ('scripted','reality')),
  title text not null,
  poster_url text,
  release_year integer,
  genres text[] not null default '{}',
  overview text not null default '',
  external_rating real,
  external_ratings jsonb not null default '[]',
  number_of_seasons integer,
  note text,
  -- Persisted per-user manual order. Not exposed to anyone else yet, but
  -- keeping it well-defined now is what lets a future Friends feature show
  -- recommendations in the order the owner actually intended.
  sort_order integer not null default 0,
  date_added timestamptz not null default now(),
  -- Hard backstop against duplicates, on top of the app's own check.
  unique (user_id, external_source, external_id)
);

create index recommendations_user_id_idx on public.recommendations(user_id);
alter table public.recommendations enable row level security;

create policy "Users can view their own recommendations"
  on public.recommendations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recommendations"
  on public.recommendations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own recommendations"
  on public.recommendations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own recommendations"
  on public.recommendations for delete
  using (auth.uid() = user_id);

-- ---------- friendships ----------
-- One row per relationship *or* pending request between two users — status
-- distinguishes them, so there's exactly one row per pair, ever, rather
-- than two parallel tables to keep in sync. user_low/user_high (always the
-- smaller/larger of the two ids) are what the unique constraint is really
-- on, so the pair (A,B) and (B,A) can never both exist regardless of who
-- sent the request.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  user_low uuid generated always as (least(requester_id, addressee_id)) stored,
  user_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id),
  unique (user_low, user_high)
);

create index friendships_addressee_idx on public.friendships(addressee_id);
create index friendships_requester_idx on public.friendships(requester_id);
alter table public.friendships enable row level security;

create policy "Users can view their own friendships/requests"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send a friend request"
  on public.friendships for insert
  with check (auth.uid() = requester_id and status = 'pending');

-- Covers cancel (requester deletes a pending row), decline (addressee
-- deletes a pending row), and Remove Friend (either party deletes an
-- accepted row) — all three are just "delete a row I'm part of", so one
-- policy is enough. There's no "declined"/"cancelled" status: the row is
-- simply gone, which is exactly what lets a new request be sent afterward
-- (the unique constraint only blocks *existing* rows).
create policy "Users can delete their own friendships/requests"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Deliberately no UPDATE policy at all — the only status transition
-- (pending -> accepted) only ever happens through accept_friend_request()
-- below, so there is no raw-PATCH path that could let someone silently
-- reassign requester_id/addressee_id on an existing row while "accepting"
-- it, or insert a row as already-accepted.

-- The one controlled way to reach status='accepted'. security definer so
-- its own `where` clause (not a client-suppliable RLS check) is the entire
-- security boundary: the caller only ever supplies a request id, so there
-- is no way to influence which row changes or what it changes to.
create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friendships
  set status = 'accepted', responded_at = now()
  where id = request_id
    and addressee_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Request not found or not eligible to accept';
  end if;
end;
$$;

-- Exact-username lookup — no listing/browsing capability, one exact
-- (case-insensitive) match or nothing. This is the only way the app can
-- ever discover another user's id.
create or replace function public.find_user_by_username(search_username text)
returns table(id uuid, username text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.username
  from public.profiles p
  where lower(p.username) = lower(search_username)
  limit 1;
$$;

-- Still no public directory — this only reveals a profile (username,
-- display_name) to someone who already has a friendships row with them
-- (pending in either direction, or accepted), so the Friends screen can
-- render a name instead of a bare uuid. A stranger's profile stays
-- invisible. Additive to the existing "view your own profile" policy —
-- Postgres OR's multiple select policies together.
create policy "Users can view profiles of people they have a friendship or request with"
  on public.profiles for select
  using (
    exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
  );

-- ---------- recommendations: friend visibility ----------
-- Additive to the existing "Users can view their own recommendations"
-- policy — Postgres OR's multiple select policies together, so this only
-- ever *adds* visibility, never removes the owner's own access. Requires
-- status = 'accepted' specifically — a pending request must never grant
-- access to someone's recommendations.
create policy "Users can view accepted friends' recommendations"
  on public.recommendations for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = recommendations.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recommendations.user_id)
        )
    )
  );

-- ---------- recommendation_views: per-recipient "New" marker ----------
-- Deliberately a separate table, not a column on recommendations — the
-- "New" state is per (recommendation, viewer) pair, not a global property
-- of the recommendation itself, and this never touches the sender's row.
-- Only ever inserted, never updated: once viewed, always viewed. Absence
-- of a row = "New" for that viewer.
create table public.recommendation_views (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (recommendation_id, viewer_id)
);

alter table public.recommendation_views enable row level security;

create policy "Users can view their own view-history"
  on public.recommendation_views for select
  using (auth.uid() = viewer_id);

create policy "Users can mark things viewed for themselves"
  on public.recommendation_views for insert
  with check (auth.uid() = viewer_id);

-- ---------- omdb_usage: shared, app-wide daily OMDb request counter ----------
-- There is one OMDb API key for the entire app (not one per user), and one
-- shared 1,000-requests/day cap that everyone draws from — so usage has to
-- be tracked centrally, not per browser/device/user. One row per calendar
-- date (in the database's own timezone, UTC on Supabase by default); every
-- real OMDb request from every user increments the same row for today.
-- Only ever written by the omdb-proxy Edge Function, via its service-role
-- connection (which bypasses RLS entirely) calling increment_omdb_usage()
-- below — there is deliberately no INSERT/UPDATE/DELETE policy for regular
-- users, so no client can ever touch this table directly, only read it.
create table public.omdb_usage (
  usage_date date primary key,
  request_count integer not null default 0
);

alter table public.omdb_usage enable row level security;

-- Not scoped to any particular user — this is intentionally one shared
-- number every signed-in user sees identically, same as the requirement
-- that prompted it (one shared key, one shared daily limit).
create policy "Any signed-in user can view today's OMDb usage"
  on public.omdb_usage for select
  using (true);

-- security definer + the upsert-with-increment (not a read-then-write from
-- application code) is what keeps this atomic under concurrent requests
-- from different users hitting it at the same moment.
create or replace function public.increment_omdb_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.omdb_usage (usage_date, request_count)
  values (current_date, 1)
  on conflict (usage_date)
  do update set request_count = public.omdb_usage.request_count + 1
  returning request_count into new_count;
  return new_count;
end;
$$;

-- ---------- required table grants ----------
-- Row Level Security only decides which *rows* a query can see once it's
-- already allowed to touch the table at all — Postgres still requires the
-- base table-level privileges below independently of RLS. Supabase's Table
-- Editor sets these up for you automatically when you create a table there;
-- a table created via raw SQL (as above) does not get them for free, so
-- without this every request fails with "permission denied for table ..."
-- before RLS is ever evaluated. Scoped only to `authenticated` — this app
-- has no public/anon data access at all, so `anon` gets nothing here.
grant select, insert, update, delete on public.watchlist_items to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.recommendations to authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.find_user_by_username(text) to authenticated;
grant select, insert on public.recommendation_views to authenticated;
grant select on public.omdb_usage to authenticated;
grant execute on function public.increment_omdb_usage() to service_role;
