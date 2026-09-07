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
  -- Explicit, stored sharing mode for the Friends feature — "all" means
  -- every current *and future* accepted friend can see this
  -- recommendation; "selected" means only the friendships with no row in
  -- recommendation_hidden_friends can. Deliberately a real column, not
  -- inferred from whether any recommendation_hidden_friends rows exist:
  -- a "selected" recommendation with every current friend individually
  -- picked has zero hidden rows too, which would be indistinguishable
  -- from "all" (and would wrongly grant a later-added friend access) if
  -- this were inferred instead of stored.
  audience text not null default 'all' check (audience in ('all', 'selected')),
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

-- ---------- recommendation_hidden_friends: per-friend sharing exclusions ----------
-- A row means "this recommendation is hidden from this friendship" —
-- absence means visible. This is deliberately an exclusion list, not an
-- inclusion list: the default ("All friends" — shared with every current
-- *and future* accepted friend) costs zero rows here, and only a
-- recommendation explicitly narrowed to "Selected friends" ever has rows.
-- friendship_id (not a bare friend user id) is what lets removing and
-- re-adding the same friend start "Selected friends" sharing over from
-- scratch — see accept_friend_request() below, which seeds this table
-- with a hidden row for the new friendship against every recommendation
-- already in "Selected friends" mode (never against one in "All friends"
-- mode, which a new/re-added friend should simply see immediately), and
-- the `on delete cascade` below, which wipes every hidden row tied to a
-- friendship the moment that friendship is deleted (Remove Friend).
create table public.recommendation_hidden_friends (
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recommendation_id, friendship_id)
);

create index recommendation_hidden_friends_friendship_idx on public.recommendation_hidden_friends(friendship_id);
alter table public.recommendation_hidden_friends enable row level security;

-- SECURITY DEFINER helper — required to avoid an RLS recursion cycle,
-- not just a style choice. Without it, recommendation_hidden_friends's
-- policies below would query recommendations directly to check
-- ownership; but recommendations' own friends-visibility policy (further
-- down this file) queries recommendation_hidden_friends, and RLS applies
-- to every table access, including one table's policy reading another —
-- so evaluating "can this row of recommendations be seen" would need
-- "is this row of recommendation_hidden_friends visible", which would
-- need "can this row of recommendations be seen" again, and Postgres
-- rejects that with `infinite recursion detected in policy for relation
-- "recommendations"` (42P17) rather than looping forever.
--
-- Running as the function owner (not the calling role) is what breaks
-- the cycle: by default a table's owner is exempt from its own RLS
-- policies (recommendation_hidden_friends never sets FORCE ROW LEVEL
-- SECURITY, so this isn't overridden), so this one internal ownership
-- lookup does not re-trigger recommendations' policies at all. It does
-- nothing beyond that single yes/no ownership check — no data is
-- returned, no other privilege is exercised — and search_path is fixed
-- so it can't be redirected by a caller-controlled search_path.
create or replace function public.owns_recommendation(p_recommendation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.recommendations r
    where r.id = p_recommendation_id
      and r.user_id = auth.uid()
  );
$$;

-- Only the owner of the recommendation may see or manage its hidden-friend
-- rows — a friend never reads this table directly, they just don't see the
-- recommendation via the updated recommendations select policy below.
-- Ownership is checked via owns_recommendation() (see above) rather than
-- a direct subquery on recommendations, specifically to avoid the RLS
-- recursion cycle explained there. The with check on insert also
-- requires friendship_id to actually be one of the owner's own accepted
-- friendships (a plain subquery on friendships — that table's own
-- policies never reference recommendations or recommendation_hidden_
-- friends, so there's no cycle risk there), so this can never be used to
-- write an unrelated pairing.
create policy "Owners can view hidden-friend rows for their own recommendations"
  on public.recommendation_hidden_friends for select
  using (public.owns_recommendation(recommendation_id));

create policy "Owners can hide friends from their own recommendations"
  on public.recommendation_hidden_friends for insert
  with check (
    public.owns_recommendation(recommendation_id)
    and exists (
      select 1 from public.friendships f
      where f.id = recommendation_hidden_friends.friendship_id
        and f.status = 'accepted'
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

create policy "Owners can unhide friends from their own recommendations"
  on public.recommendation_hidden_friends for delete
  using (public.owns_recommendation(recommendation_id));

-- Atomically sets one recommendation's *entire* audience — its explicit
-- mode (recommendations.audience) and its hidden-friendship set — in a
-- single transaction, rather than the client issuing separate statements
-- over multiple round trips. Multiple round trips were the root cause of
-- an intermittent bug: if a second Save (e.g. the user editing again
-- shortly after) started before the first Save's writes had all landed,
-- the requests' statements could interleave and leave the *first* save's
-- state as final instead of the second, more recent one. Bundling every
-- write into one function call makes each Save a single all-or-nothing
-- transaction, so two overlapping Saves can no longer interleave —
-- whichever one's transaction commits last simply and cleanly wins
-- outright.
--
-- Deliberately NOT security definer — every statement still runs as the
-- calling user: the update is authorized by the existing "Users can
-- update their own recommendations" policy (unaffected by this feature —
-- it never referenced recommendation_hidden_friends, so there's no
-- recursion risk there), and the delete/insert are authorized by the
-- owner-only recommendation_hidden_friends policies above (via
-- owns_recommendation()). An unowned recommendation_id or a
-- friendship_id that isn't one of the caller's own accepted friendships
-- is rejected exactly the same way raw statements already were.
create or replace function public.set_recommendation_audience(
  p_recommendation_id uuid,
  p_audience text,
  p_hidden_friendship_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_hidden_ids uuid[];
begin
  update public.recommendations
  set audience = p_audience
  where id = p_recommendation_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Recommendation not found or not owned by caller';
  end if;

  -- An "all friends" recommendation never has hidden rows in storage —
  -- they'd be inert anyway (the select policy below grants access
  -- unconditionally when audience = 'all'), but keeping the invariant
  -- literal avoids ever wondering why one has rows.
  v_hidden_ids := case when p_audience = 'all' then '{}'::uuid[] else p_hidden_friendship_ids end;

  delete from public.recommendation_hidden_friends
  where recommendation_id = p_recommendation_id;

  insert into public.recommendation_hidden_friends (recommendation_id, friendship_id)
  select p_recommendation_id, fid
  from unnest(v_hidden_ids) as fid;
end;
$$;

-- Same atomicity fix as above, for the Manage Friends per-friend Select
-- All / Clear All bulk action (one friendship, many recommendations)
-- instead of the per-recommendation case. Reviewed against the audience
-- column above and left unchanged: this only ever writes hidden rows,
-- never recommendations.audience, and a hidden row is inert for any
-- recommendation currently in "all" mode (see the select policy below) —
-- toggling one friend's visibility into a specific "all friends"
-- recommendation from here has no effect by design; switching that one
-- recommendation to "Selected friends" (via its own Sharing screen) is
-- what actually changes who can see it.
--
-- Explicit authorization, not just RLS-by-implication: the delete below
-- has no ownership condition of its own — its WHERE clause is only
-- `friendship_id = p_friendship_id`. Today that's still safe in
-- practice, because it runs as SECURITY INVOKER and the delete policy
-- above (`owns_recommendation(recommendation_id)`) intersects with it
-- per row, and a hidden row's recommendation_id is always owned by
-- whoever legitimately created it — so a caller can never actually
-- delete a row tied to someone else's recommendation no matter what
-- friendship_id they pass. But that protection is *implicit*, entirely
-- contingent on the delete policy staying exactly as it is, and this
-- function asserted nothing about it on its own. The two checks below
-- make the authorization boundary explicit and independent of that
-- coincidence: p_friendship_id must be one of the caller's own accepted
-- friendships, and every id in p_recommendation_ids must be a
-- recommendation the caller owns (via owns_recommendation(), the same
-- helper the RLS policies above already use) — both checked, and an
-- exception raised on failure, *before* anything is deleted or
-- inserted, so validation + delete + insert remain one all-or-nothing
-- transaction.
create or replace function public.replace_recommendation_hidden_friends_for_friendship(
  p_friendship_id uuid,
  p_recommendation_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.friendships f
    where f.id = p_friendship_id
      and f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  ) then
    raise exception 'Friendship not found or not accepted for caller';
  end if;

  if exists (
    select 1 from unnest(p_recommendation_ids) as rid
    where not public.owns_recommendation(rid)
  ) then
    raise exception 'One or more recommendations are not owned by caller';
  end if;

  delete from public.recommendation_hidden_friends
  where friendship_id = p_friendship_id;

  insert into public.recommendation_hidden_friends (recommendation_id, friendship_id)
  select rid, p_friendship_id
  from unnest(p_recommendation_ids) as rid;
end;
$$;

-- The one controlled way to reach status='accepted'. security definer so
-- its own `where` clause (not a client-suppliable RLS check) is the entire
-- security boundary: the caller only ever supplies a request id, so there
-- is no way to influence which row changes or what it changes to.
--
-- Also seeds recommendation_hidden_friends (see above) with a hidden row
-- for this new friendship_id against every existing recommendation whose
-- stored audience = 'selected' — never against one whose audience =
-- 'all'. Checking the explicit audience column (not "does this
-- recommendation already have any hidden rows") is what makes this
-- correct: a "selected" recommendation can legitimately have zero hidden
-- rows right now (every current friend individually picked), and it must
-- still get backfilled here, or a later-added friend would wrongly see
-- it. "All friends" means exactly that: every accepted friend, present
-- *and future*, so a newly (re-)accepted friend must see those
-- immediately, with no backfill needed (absence of a hidden row already
-- means visible). "Selected friends" stays exactly what it says —
-- explicit and static — so a new friend defaults to *not* seeing those
-- until the owner explicitly adds them, exactly like every other friend
-- not on that list. Because friendship_id is a fresh uuid every time a
-- request is sent, removing and re-adding the same person re-runs this
-- from scratch against a new id: they immediately regain "All friends"
-- visibility (that's the point — those are dynamic by definition) but
-- never inherit any old "Selected friends" grant.
create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid;
  v_addressee_id uuid;
begin
  update public.friendships
  set status = 'accepted', responded_at = now()
  where id = request_id
    and addressee_id = auth.uid()
    and status = 'pending'
  returning requester_id, addressee_id into v_requester_id, v_addressee_id;

  if not found then
    raise exception 'Request not found or not eligible to accept';
  end if;

  insert into public.recommendation_hidden_friends (recommendation_id, friendship_id)
  select r.id, request_id
  from public.recommendations r
  where r.user_id in (v_requester_id, v_addressee_id)
    and r.audience = 'selected';
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
-- access to someone's recommendations. For audience = 'all' that's the
-- whole check — every accepted friend sees it, full stop. For audience =
-- 'selected', also requires that this specific friendship isn't excluded
-- via recommendation_hidden_friends — see that table above for how a
-- "selected" recommendation's specific audience is stored. This
-- recommendation_hidden_friends reference is safe from the RLS
-- recursion that table's own policies would otherwise create with this
-- one — see owns_recommendation() above for the full explanation; that
-- helper is what breaks the cycle, not anything about the audience
-- column added here.
create policy "Users can view accepted friends' visible recommendations"
  on public.recommendations for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = recommendations.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recommendations.user_id)
        )
        and (
          recommendations.audience = 'all'
          or not exists (
            select 1 from public.recommendation_hidden_friends h
            where h.recommendation_id = recommendations.id
              and h.friendship_id = f.id
          )
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
grant select, insert, delete on public.recommendation_hidden_friends to authenticated;

-- PostgreSQL grants EXECUTE on every newly created function to PUBLIC by
-- default (unlike tables/sequences/schemas, which grant nothing to
-- PUBLIC) — a plain `grant ... to authenticated` below is additive and
-- does not remove that implicit grant on its own. Both of these are
-- SECURITY DEFINER, so an explicit revoke matters here specifically:
-- their internal logic already happens to make an anonymous call
-- harmless today (auth.uid() is null for `anon`, so
-- owns_recommendation() always returns false and accept_friend_request()
-- always hits its `raise exception` before touching a row), but
-- authorization should come from the privilege system itself, not from
-- incidentally-safe function bodies. set_recommendation_audience() and
-- replace_recommendation_hidden_friends_for_friendship() don't need the
-- same treatment — they're SECURITY INVOKER, so an anon call would run
-- as `anon`, which was never granted any base privilege on
-- public.recommendations or public.recommendation_hidden_friends at all
-- (see the comment above this block) and would fail with a permission
-- error before RLS is even reached, independently of this function's own
-- grants.
revoke execute on function public.owns_recommendation(uuid) from public;
revoke execute on function public.accept_friend_request(uuid) from public;

grant execute on function public.owns_recommendation(uuid) to authenticated;
grant execute on function public.set_recommendation_audience(uuid, text, uuid[]) to authenticated;
grant execute on function public.replace_recommendation_hidden_friends_for_friendship(uuid, uuid[]) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.find_user_by_username(text) to authenticated;
grant select, insert on public.recommendation_views to authenticated;
grant select on public.omdb_usage to authenticated;
grant execute on function public.increment_omdb_usage() to service_role;
