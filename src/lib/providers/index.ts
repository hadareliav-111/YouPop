import type { FullDetails, MediaProvider, MediaSource, SearchResultItem } from "./types";
import { tvmazeProvider, getEpisodes as tvmazeGetEpisodes, type TvmazeEpisode } from "./tvmaze";
import { omdbProvider, isOmdbConfigured } from "./omdb";
import { mockMovieProvider } from "./mockMovies";
import { titleRelevance, RELEVANCE_TIERS } from "./relevance";

export type { SearchResultItem, FullDetails, MediaSource, TvSubtype } from "./types";
export type { TvmazeEpisode } from "./tvmaze";
export { ProviderRequestError } from "./types";

// Movies come from OMDb once a key is configured; until then, a mock
// dataset keeps the whole app (search, add, filter, detail) testable.
// Swapping in a different real provider later is a one-line change here.
const movieProvider: MediaProvider = isOmdbConfigured()
  ? omdbProvider
  : mockMovieProvider;

export const usingMockMovieData = !isOmdbConfigured();
export { isOmdbConfigured };

const providersByType = {
  tv: tvmazeProvider,
  movie: movieProvider,
};

const providersById: Record<MediaSource, MediaProvider> = {
  tvmaze: tvmazeProvider,
  omdb: omdbProvider,
  "mock-movie": mockMovieProvider,
};

// In-memory, session-lifetime caches. These exist purely to avoid redundant
// network calls (OMDb has a daily request cap) — they are NOT where saved
// watchlist data lives; a saved item's full details are already copied onto
// the WatchlistItem itself at add-time (see AddScreen), so reopening or
// refreshing the app never re-fetches from any provider for existing items.
// This only helps the rarer case of re-searching or re-selecting the same
// title again within one session (e.g. reopening the Add modal, retyping a
// query, or re-picking a result you didn't end up adding).
const searchCache = new Map<string, SearchResultItem[]>();
const detailsCache = new Map<string, FullDetails>();

// Caps how many combined results we ever show. Providers (especially
// TVmaze's fuzzy engine) can return dozens of loosely-related titles; once
// they're properly ranked by relevance, showing more than this is just
// noise — the real answer is always near the top.
const MAX_RESULTS = 24;

export async function searchAll(
  query: string,
  signal?: AbortSignal,
): Promise<{ results: SearchResultItem[]; failedSources: MediaSource[] }> {
  const normalized = query.trim().toLowerCase();
  const entries = Object.values(providersByType);
  const settled = await Promise.allSettled(
    entries.map((p) => {
      const cacheKey = `${p.id}::${normalized}`;
      const cached = searchCache.get(cacheKey);
      if (cached) return Promise.resolve(cached);
      return p.search(query, signal).then((r) => {
        searchCache.set(cacheKey, r);
        return r;
      });
    }),
  );

  const results: SearchResultItem[] = [];
  const failedSources: MediaSource[] = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else if (!(outcome.reason instanceof DOMException)) {
      failedSources.push(entries[i].id);
    }
  });

  // Score every result by how closely its title actually matches the query
  // (see relevance.ts for the tier scheme), drop anything with no real
  // relation at all, and use each provider's own confidence score as a
  // tie-breaker within an identical tier (e.g. TVmaze's fuzzy score ranks
  // "Friends" (1994) above a same-tier but less-likely alternate).
  const scored = results
    .map((r) => ({ item: r, score: titleRelevance(r.title, query) }))
    .filter((r) => r.score > RELEVANCE_TIERS.NONE);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.item.providerScore ?? 0) - (a.item.providerScore ?? 0);
  });

  return {
    results: scored.slice(0, MAX_RESULTS).map((r) => r.item),
    failedSources,
  };
}

export async function getDetails(
  source: MediaSource,
  externalId: string,
  signal?: AbortSignal,
): Promise<FullDetails> {
  const cacheKey = `${source}::${externalId}`;
  const cached = detailsCache.get(cacheKey);
  if (cached) return cached;

  const details = await providersById[source].getDetails(externalId, signal);
  detailsCache.set(cacheKey, details);
  return details;
}

// Only TVmaze shows have episodes; used both for the "coming up" countdown
// (computed relative to the user's own watched progress) and the "I've
// watched up to..." picker. Cached for the session — episode lists for
// already-released seasons never change, and even a "next episode" airdate
// is fine to treat as stable within one sitting.
const episodesCache = new Map<string, TvmazeEpisode[]>();

export async function getEpisodes(
  source: MediaSource,
  externalId: string,
): Promise<TvmazeEpisode[]> {
  if (source !== "tvmaze") return [];
  const cacheKey = `${source}::${externalId}`;
  const cached = episodesCache.get(cacheKey);
  if (cached) return cached;
  const episodes = await tvmazeGetEpisodes(externalId);
  episodesCache.set(cacheKey, episodes);
  return episodes;
}
