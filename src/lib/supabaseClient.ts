import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // A required one-time setup step (see supabase/schema.sql and the project
  // notes), not a runtime condition end users can hit — fail loudly rather
  // than silently rendering a broken app.
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Add them to your .env file (see .env.example) and restart the dev server.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase Auth is email-based at the protocol level, but the app only ever
// asks for a username — this fixed, non-resolvable placeholder domain is an
// internal implementation detail that turns "username" into a valid-looking
// email for signInWithPassword. Nothing is ever sent to it, and no UI copy,
// label, or error message should ever surface it.
export const AUTH_EMAIL_DOMAIN = "watchlist.local";
