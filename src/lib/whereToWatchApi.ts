import type { MediaSource } from "../types";
import { supabase } from "./supabaseClient";

const TABLE = "where_to_watch_cache";
const COUNTRY = "il";

// Bounds how long we wait on the motn-proxy invocation specifically (not
// the Supabase cache read above it, which never talks to an external
// API and isn't at risk of hanging the same way). If it fires, the
// client simply stops waiting — it does not, and cannot, cancel the
// Edge Function's own execution, which keeps running server-side and
// still writes a correct row to the shared cache via its service-role
// connection once it finishes. So a timeout here never causes a wrong
// "not available" to be cached — the client was never the one writing
// to that table in the first place, only motn-proxy is.
const MOTN_TIMEOUT_MS = 12000;

// Deliberately excludes availability type (subscription/rent/buy/free) —
// the UI never shows it (see components/WhereToWatch.tsx); the Edge
// Function already picked the single best link per provider before this
// ever reaches the client or the cache.
export interface WhereToWatchProvider {
  id: string;
  name: string;
  logoUrl: string | null;
  link: string;
}

interface CacheRow {
  streaming_options: WhereToWatchProvider[];
}

// Session-lifetime cache of in-flight/resolved lookups, same "just a Map"
// pattern as providers/index.ts's detailsCache/episodesCache — but keyed
// to the *promise*, set before any async work starts, not just the
// eventual resolved value. That's what lets a second call for the same
// key (React StrictMode's deliberate double-effect-invocation in dev
// being the common case, but any rapid re-navigation too) reuse the
// exact same in-flight request instead of starting a redundant one,
// which is what was turning one screen-open into two real Movie of the
// Night requests. A rejected promise (including a motn-proxy timeout) is
// removed so a later attempt retries cleanly instead of reusing a dead
// promise forever.
const sessionCache = new Map<string, Promise<WhereToWatchProvider[]>>();

function sessionCacheKey(externalSource: MediaSource, externalId: string): string {
  return `${externalSource}::${externalId}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for Where to Watch data."));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Reads the shared where_to_watch_cache table directly first — a plain,
// RLS-permitted select, no Edge Function invocation at all — since most
// requests are for a title someone has already looked up before. Only on
// a genuine cache miss (no row at all — an empty streaming_options array
// on an existing row is still a cache *hit*, meaning "confirmed not
// available") does this fall back to motn-proxy, which resolves an IMDb
// id, calls Movie of the Night, writes the row via its own service-role
// connection, and returns the same shape back here.
async function resolveWhereToWatch(
  externalSource: MediaSource,
  externalId: string,
): Promise<WhereToWatchProvider[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("streaming_options")
    .eq("external_source", externalSource)
    .eq("external_id", externalId)
    .eq("country", COUNTRY)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    return (data as CacheRow).streaming_options ?? [];
  }

  const { data: fnData, error: fnError } = await withTimeout(
    supabase.functions.invoke<{ providers: WhereToWatchProvider[]; error?: string }>(
      "motn-proxy",
      { body: { externalSource, externalId } },
    ),
    MOTN_TIMEOUT_MS,
  );
  if (fnError) throw fnError;
  // motn-proxy's own "not configured" response (missing MOTN_API_KEY)
  // currently returns HTTP 200 with an `error` field rather than a non-2xx
  // status — which supabase-js would otherwise treat as a successful,
  // genuinely-empty answer. Treating any `error` field (or a missing body
  // entirely) as a real failure here, on top of the non-2xx case above,
  // is what keeps a server-side misconfiguration or quota exhaustion from
  // ever being cached/shown as "confirmed not available in Israel".
  if (!fnData || fnData.error) {
    throw new Error(fnData?.error ?? "Where to Watch lookup returned no data.");
  }
  return fnData.providers ?? [];
}

export function fetchWhereToWatch(
  externalSource: MediaSource,
  externalId: string,
): Promise<WhereToWatchProvider[]> {
  const key = sessionCacheKey(externalSource, externalId);
  const existing = sessionCache.get(key);
  if (existing) return existing;

  const promise = resolveWhereToWatch(externalSource, externalId);
  sessionCache.set(key, promise);
  promise.catch(() => sessionCache.delete(key));
  return promise;
}
