// TVmaze API — fully free, no API key, no account, no registration.
// Docs: https://www.tvmaze.com/api
// Attribution isn't contractually required, but we credit it in the About
// panel anyway since it's the source of all TV/reality data.

import type { FullDetails, MediaProvider, SearchResultItem, TvSubtype } from "./types";
import { ProviderRequestError } from "./types";
import { getRatingsByImdbId, isOmdbConfigured } from "./omdb";

const BASE_URL = "https://api.tvmaze.com";

interface TvmazeShow {
  id: number;
  name: string;
  type: string; // "Scripted", "Reality", "Documentary", "Game Show", ...
  genres: string[];
  premiered: string | null;
  image: { medium: string | null; original: string | null } | null;
  summary: string | null;
  rating: { average: number | null };
  externals?: { imdb: string | null };
}

interface TvmazeSearchEntry {
  score: number;
  show: TvmazeShow;
}

export interface TvmazeEpisode {
  id: number;
  season: number;
  number: number;
  name: string;
  airdate: string; // "2026-09-23", "" if unscheduled
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").trim();
}

function yearFromDate(date: string | null): number | null {
  if (!date) return null;
  const year = parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function subtypeFromShow(show: TvmazeShow): TvSubtype {
  return show.type === "Reality" ? "reality" : "scripted";
}

async function tvmazeFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ProviderRequestError(
      "Couldn't reach TVmaze. Check your internet connection.",
    );
  }
  if (res.status === 404) {
    throw new ProviderRequestError("That show couldn't be found.");
  }
  if (!res.ok) {
    throw new ProviderRequestError(`TVmaze request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

function toSearchResult(entry: TvmazeSearchEntry): SearchResultItem {
  const show = entry.show;
  return {
    externalId: String(show.id),
    source: "tvmaze",
    mediaType: "tv",
    tvSubtype: subtypeFromShow(show),
    title: show.name,
    year: yearFromDate(show.premiered),
    posterUrl: show.image?.medium ?? null,
    overview: stripHtml(show.summary),
    providerScore: entry.score,
  };
}

async function search(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResultItem[]> {
  if (!query.trim()) return [];
  const entries = await tvmazeFetch<TvmazeSearchEntry[]>(
    `/search/shows?q=${encodeURIComponent(query)}`,
    signal,
  );
  return entries.map(toSearchResult);
}

async function getDetails(
  externalId: string,
  signal?: AbortSignal,
): Promise<FullDetails> {
  const show = await tvmazeFetch<TvmazeShow>(`/shows/${externalId}`, signal);

  let numberOfSeasons: number | null = null;
  try {
    const seasons = await tvmazeFetch<unknown[]>(
      `/shows/${externalId}/seasons`,
      signal,
    );
    numberOfSeasons = seasons.length || null;
  } catch {
    // Non-critical — leave as null if the seasons lookup fails.
  }

  const externalRatings = show.rating?.average
    ? [{ source: "TVmaze", value: `${show.rating.average.toFixed(1)}/10` }]
    : [];

  // OMDb is enrichment-only here, never a replacement for TVmaze: it's used
  // solely to append IMDb/Rotten Tomatoes/Metacritic scores when available,
  // looked up by TVmaze's own `externals.imdb` id (exact, no title matching
  // involved) and wrapped so any failure — no key configured, network error,
  // no IMDb id on this show — just leaves TVmaze's own rating untouched.
  if (isOmdbConfigured() && show.externals?.imdb) {
    try {
      const enrichment = await getRatingsByImdbId(show.externals.imdb, signal);
      externalRatings.push(...enrichment);
    } catch {
      // Non-critical — TV show details are already complete without it.
    }
  }

  return {
    externalId: String(show.id),
    source: "tvmaze",
    mediaType: "tv",
    tvSubtype: subtypeFromShow(show),
    title: show.name,
    releaseYear: yearFromDate(show.premiered),
    releaseDate: show.premiered ?? null, // TVmaze already gives "YYYY-MM-DD"
    // TVmaze's "original" image can be several MB at full resolution —
    // far more than needed even for the large detail-view poster, so we
    // standardize on "medium" everywhere for fast loads on mobile data.
    posterUrl: show.image?.medium ?? null,
    overview: stripHtml(show.summary),
    externalRating: show.rating?.average ?? null,
    externalRatings,
    genres: show.genres ?? [],
    numberOfSeasons,
  };
}

// Full episode list, in air order — used both to compute "next unwatched
// episode" relative to the user's own progress (a future/unaired episode
// with a known airdate is included here too, not just already-aired ones)
// and to power the "I've watched up to..." picker.
export async function getEpisodes(
  externalId: string,
  signal?: AbortSignal,
): Promise<TvmazeEpisode[]> {
  try {
    const episodes = await tvmazeFetch<TvmazeEpisode[]>(
      `/shows/${externalId}/episodes`,
      signal,
    );
    return episodes.map((e) => ({
      id: e.id,
      season: e.season,
      number: e.number,
      name: e.name,
      airdate: e.airdate ?? "",
    }));
  } catch {
    return [];
  }
}

export const tvmazeProvider: MediaProvider = {
  id: "tvmaze",
  search,
  getDetails,
};
