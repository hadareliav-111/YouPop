// OMDb API — free tier: 1,000 requests/day, no credit card. There's a
// single OMDb key for the whole app (not one per user), so every request
// goes through the omdb-proxy Supabase Edge Function instead of calling
// OMDb directly from the browser: that's what keeps the real key out of
// the client bundle, and what lets usage be tracked as one shared,
// app-wide daily counter (see lib/apiUsage.ts and supabase/schema.sql's
// omdb_usage table) rather than per browser/device.
// Docs: https://www.omdbapi.com/ · Edge Function: supabase/functions/omdb-proxy

import type { ExternalRating, FullDetails, MediaProvider, SearchResultItem } from "./types";
import { ProviderRequestError } from "./types";
import { searchWithTypoFallback } from "./searchHelpers";
import { supabase } from "../supabaseClient";

// Purely a local on/off switch for this environment (mock data vs. the
// real proxy) — never the API key itself, which now lives only as the
// omdb-proxy function's OMDB_API_KEY secret.
const PROXY_ENABLED = import.meta.env.VITE_OMDB_PROXY_ENABLED === "true";

export function isOmdbConfigured(): boolean {
  return PROXY_ENABLED;
}

interface OmdbSearchEntry {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
  Type: string;
}

interface OmdbSearchResponse {
  Response: "True" | "False";
  Search?: OmdbSearchEntry[];
  Error?: string;
}

interface OmdbRatingEntry {
  Source: string;
  Value: string;
}

interface OmdbDetailsResponse {
  Response: "True" | "False";
  Error?: string;
  imdbID: string;
  Title: string;
  Year: string;
  Genre: string;
  Plot: string;
  Poster: string;
  imdbRating: string;
  Ratings?: OmdbRatingEntry[];
  Type: string;
  totalSeasons?: string;
  Released?: string; // "18 Dec 2026", or "N/A"
}

// OMDb's free API already includes this — no paid tier gates it. It only
// lists sources that actually have a score for the title (never all three),
// which is exactly the "only show what's provided" behavior we want.
const SOURCE_LABELS: Record<string, string> = {
  "Internet Movie Database": "IMDb",
  "Rotten Tomatoes": "Rotten Tomatoes",
  Metacritic: "Metacritic",
};

function parsePoster(poster: string | undefined): string | null {
  return poster && poster !== "N/A" ? poster : null;
}

function parseYear(year: string | undefined): number | null {
  if (!year) return null;
  const parsed = parseInt(year.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// OMDb's "Released" field is a human string like "18 Dec 2026" (or "N/A").
// Parsed via the Date constructor (reliably handles this exact format) and
// re-serialized as a plain "YYYY-MM-DD" so it's timezone-independent for
// same-day comparisons elsewhere.
function parseReleaseDate(released: string | undefined): string | null {
  if (!released || released === "N/A") return null;
  const parsed = new Date(released);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function omdbFetch<T extends { Response: string; Error?: string }>(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  if (!PROXY_ENABLED) {
    throw new ProviderRequestError("OMDb is not enabled in this environment.");
  }

  // supabase-js never throws here — network/HTTP failures come back as
  // `error` instead, which is why this isn't wrapped in try/catch. An
  // aborted request (e.g. the user kept typing) surfaces as a
  // FunctionsFetchError whose `context` is the original AbortError; it's
  // rethrown as-is so callers' existing `err.name === "AbortError"` checks
  // (see AddFlow/SearchStep.tsx) keep working unchanged.
  const { data, error } = await supabase.functions.invoke<T>("omdb-proxy", {
    body: { params },
    signal,
  });

  if (error) {
    if (error.context instanceof DOMException && error.context.name === "AbortError") {
      throw error.context;
    }
    throw new ProviderRequestError(
      "Couldn't reach OMDb. Check your internet connection.",
    );
  }
  // The invoke() result type is a discriminated union (error present XOR
  // data present) — having already handled the error case above, data is
  // guaranteed non-null here.
  if (data === null) {
    throw new ProviderRequestError("OMDb request failed.");
  }

  if (data.Response === "False") {
    // OMDb reports a variety of "no results" conditions this way, not just
    // "Movie not found!" — e.g. "Too many results." (confirmed live: OMDb
    // returns exactly this for a Hebrew query, since it has no non-Latin
    // titles indexed and apparently falls back to an overly-broad internal
    // match it then refuses to return). None of these are technical
    // failures — they're OMDb's way of saying "zero usable results for
    // this query" — so callers should treat them as such (an empty
    // Search array), not as a thrown error. A genuine key/config problem
    // (either OMDb's or the proxy's own "not configured" message) is the
    // one failure worth actually surfacing.
    const isKeyError = /api key|not configured/i.test(data.Error ?? "");
    if (isKeyError) {
      throw new ProviderRequestError(data.Error ?? "OMDb request failed.");
    }
    return data;
  }
  return data;
}

async function literalSearch(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  const data = await omdbFetch<OmdbSearchResponse>(
    { s: query, type: "movie" },
    signal,
  );
  return (data.Search ?? []).map((entry) => ({
    externalId: entry.imdbID,
    source: "omdb" as const,
    mediaType: "movie" as const,
    tvSubtype: null,
    title: entry.Title,
    year: parseYear(entry.Year),
    posterUrl: parsePoster(entry.Poster),
    overview: "",
  }));
}

// OMDb's own search has no fuzzy tolerance at all (verified directly — see
// searchHelpers.ts) so a typo'd query gets a transposition-based retry on a
// zero-result miss rather than a general fuzzy-matching layer.
function search(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  if (!query.trim()) return Promise.resolve([]);
  return searchWithTypoFallback(query, (q) => literalSearch(q, signal));
}

async function getDetails(
  externalId: string,
  signal?: AbortSignal,
): Promise<FullDetails> {
  const data = await omdbFetch<OmdbDetailsResponse>(
    { i: externalId, plot: "short" },
    signal,
  );
  if (data.Response === "False") {
    throw new ProviderRequestError("That title couldn't be found.");
  }

  const rating = parseFloat(data.imdbRating);

  return {
    externalId: data.imdbID,
    source: "omdb",
    mediaType: "movie",
    tvSubtype: null,
    title: data.Title,
    releaseYear: parseYear(data.Year),
    releaseDate: parseReleaseDate(data.Released),
    posterUrl: parsePoster(data.Poster),
    overview: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
    externalRating: Number.isFinite(rating) ? rating : null,
    externalRatings: (data.Ratings ?? []).map((r) => ({
      source: SOURCE_LABELS[r.Source] ?? r.Source,
      value: r.Value,
    })),
    genres:
      data.Genre && data.Genre !== "N/A"
        ? data.Genre.split(",").map((g) => g.trim())
        : [],
    numberOfSeasons: null,
  };
}

// Ratings-only enrichment for TV shows, which come from TVmaze, not OMDb —
// TVmaze already returns each show's IMDb id (`externals.imdb`), so this
// looks it up directly by id rather than searching by title (avoids any
// risk of matching the wrong title, and costs exactly one request). Caching
// lives here too (keyed by imdbId) as a second, explicit safety net beyond
// providers/index.ts's per-(source,id) details cache — the outer cache
// already means this only ever runs once per show per session, but keeping
// the guarantee local to the thing that actually costs an OMDb request
// makes it obvious this can't be called twice for the same id.
const ratingsByImdbIdCache = new Map<string, ExternalRating[]>();

export async function getRatingsByImdbId(
  imdbId: string,
  signal?: AbortSignal,
): Promise<ExternalRating[]> {
  if (!isOmdbConfigured()) return [];
  const cached = ratingsByImdbIdCache.get(imdbId);
  if (cached) return cached;

  try {
    const data = await omdbFetch<OmdbDetailsResponse>({ i: imdbId }, signal);
    const ratings = (data.Ratings ?? []).map((r) => ({
      source: SOURCE_LABELS[r.Source] ?? r.Source,
      value: r.Value,
    }));
    ratingsByImdbIdCache.set(imdbId, ratings);
    return ratings;
  } catch {
    // Enrichment is a nicety, not core data — a failure here should never
    // block showing the TV show's own (TVmaze-sourced) details.
    return [];
  }
}

export const omdbProvider: MediaProvider = {
  id: "omdb",
  search,
  getDetails,
};
