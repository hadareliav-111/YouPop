# YouPop

A personal watchlist app for movies, TV shows, and reality shows — track what
you want to watch, rate what you've seen, and share recommendations with
friends. Built with React, TypeScript, and Vite, backed by Supabase
(Postgres + Auth + Row Level Security).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Movie search falls back
   to placeholder data until the OMDb proxy is set up: deploy the Edge
   Function with `supabase functions deploy omdb-proxy`, set its
   `OMDB_API_KEY` secret, then set `VITE_OMDB_PROXY_ENABLED=true`.
3. Run `supabase/schema.sql` once in your Supabase project's SQL Editor to
   create the required tables, RLS policies, and functions.
4. `npm run dev`

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build locally
