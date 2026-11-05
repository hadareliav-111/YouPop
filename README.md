# YouPop

**Live app:** https://watchlist-app-rose.vercel.app
(Invite-only: there is no public sign-up, so visitors will see the login screen.)

YouPop is a mobile-first web app for keeping a shared-with-friends watchlist of
movies, TV shows, and reality shows. It's a personal project I use with friends.

## What it does

- **Search** movies (via OMDb) and TV shows (via TVmaze) from one search box.
- **Watchlist** — save titles as *Want to watch*, *Currently watching*, or
  *Watched*, give them a personal star rating, add notes, filter by type,
  status, genre, or who recommended them, and drag to reorder.
- **Episode progress** — for shows you're watching, track which episode you're
  on and see when the next episode airs.
- **Where to watch** — shows which streaming services carry a title in Israel
  (via the Movie of the Night API).
- **Friends & recommendations** — add friends by username, recommend titles
  with a note, and choose which friends can see each recommendation.

## How to use it

1. Log in with the username and password you were given.
2. Tap **+** to search for a movie or show and add it to your watchlist.
3. Open any title to change its status, rate it, or see where to watch it.
4. Use the **Recommendations** and **Friends** tabs to share titles with friends
   and see what they recommend.

## How it's built

- **Frontend:** React 19 + TypeScript, built with Vite, deployed on Vercel.
- **Backend:** Supabase: Postgres for data, Supabase Auth for logins, and
  Row Level Security so each user can only read and change their own data
  (plus what friends have chosen to share with them).
- **Edge Functions** (`supabase/functions/`): small server-side proxies for the
  OMDb and Movie of the Night APIs, so their API keys never reach the browser.
  They also track a shared daily OMDb request quota and cache "where to watch"
  results.
- **GitHub Actions:** a scheduled workflow pings the database every few days so
  the free-tier Supabase project isn't paused for inactivity.

```
src/screens     one component per screen (Home, Detail, Episode Progress, Friends, ...)
src/components  shared UI pieces (cards, filters, modals, tab bar, ...)
src/hooks       data + state hooks (useWatchlist, useFriends, useAuth, ...)
src/lib         Supabase data access and the movie/TV search providers
supabase/       database schema (tables, RLS policies, functions) + Edge Functions
```

## Running it yourself

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `supabase/schema.sql` once in your Supabase project's SQL Editor to
   create the tables, RLS policies, and functions.
4. Create users in Supabase under **Authentication → Users** with an email of
   the form `<username>@watchlist.local`; that username is what you log in with.
5. Optional: movie search uses placeholder data until the OMDb proxy is set up.
   Deploy it with `supabase functions deploy omdb-proxy`, set its
   `OMDB_API_KEY` secret, then set `VITE_OMDB_PROXY_ENABLED=true`. "Where to
   watch" works the same way via `motn-proxy` and its `MOTN_API_KEY` secret.
6. `npm run dev`

Scripts: `npm run dev` (dev server), `npm run build` (type-check + production
build), `npm run lint` (Oxlint), `npm run preview` (preview the build).

## AI-assisted development

YouPop was built with AI-assisted development using
[Claude Code](https://claude.com/claude-code). I defined the product, features,
and UX, made the design decisions, and tested and iterated on each change;
Claude Code wrote most of the implementation under that direction.
