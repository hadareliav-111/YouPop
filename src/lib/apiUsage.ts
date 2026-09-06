// Reads the shared, app-wide OMDb usage counter (see supabase/schema.sql's
// omdb_usage table). There is one OMDb API key for the entire app, not one
// per user, and one shared 1,000-requests/day cap everyone draws from — so
// usage is tracked centrally in Supabase, incremented server-side by the
// omdb-proxy Edge Function (see providers/omdb.ts), not per browser/
// device/user. This module only *reads* that shared value; it never
// tracks or writes anything itself, and holds no local state of its own.
//
// OMDb itself never exposes account-level usage/remaining-quota anywhere
// (no endpoint, no response headers) — this is the one accurate number
// actually available: a real, shared count of every request the app's own
// proxy has made today.

import { supabase } from "./supabaseClient";

const DAILY_LIMIT = 1000;

export interface OmdbUsage {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: Date; // next UTC midnight — the boundary omdb_usage.usage_date
  // (a plain SQL `date`, populated via current_date) rolls over on, since
  // Supabase Postgres databases default to UTC.
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchOmdbUsage(): Promise<OmdbUsage> {
  const { data, error } = await supabase
    .from("omdb_usage")
    .select("request_count")
    .eq("usage_date", todayIsoUtc())
    .maybeSingle();

  if (error) throw error;

  const used = data?.request_count ?? 0;
  const resetsAt = new Date();
  resetsAt.setUTCHours(24, 0, 0, 0);

  return {
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(DAILY_LIMIT - used, 0),
    resetsAt,
  };
}
