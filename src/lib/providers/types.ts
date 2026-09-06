// Provider-agnostic contract for external media metadata sources.
// Swapping or adding a data source later (a real movie API, a different
// TV database, etc.) means writing one new file that implements this
// interface and registering it in providers/index.ts — nothing else in
// the app needs to change.

export type MediaSource = "tvmaze" | "omdb" | "mock-movie";

// Reality is a tv subtype (not a separate media type) so it stays
// filterable/identifiable without being a whole extra category.
export type TvSubtype = "scripted" | "reality";

export interface SearchResultItem {
  externalId: string;
  source: MediaSource;
  mediaType: "movie" | "tv";
  tvSubtype: TvSubtype | null;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string;
  isMockData?: boolean;
  // Optional native relevance signal from the provider's own search engine
  // (e.g. TVmaze's fuzzy-match score), used only as a secondary tie-breaker
  // after our own title-relevance scoring — never a full ranking on its own.
  providerScore?: number;
}

// One rating from one named source (IMDb, Rotten Tomatoes, Metacritic,
// TVmaze...). `value` is a ready-to-display string in that source's own
// native format (e.g. "8.8/10", "87%", "74/100") — we never fabricate or
// normalize a rating a provider doesn't actually return.
export interface ExternalRating {
  source: string;
  value: string;
}

export interface FullDetails {
  externalId: string;
  source: MediaSource;
  mediaType: "movie" | "tv";
  tvSubtype: TvSubtype | null;
  title: string;
  releaseYear: number | null;
  releaseDate: string | null; // "YYYY-MM-DD", when the provider gives a precise date
  posterUrl: string | null;
  overview: string;
  externalRating: number | null; // primary rating, 0-10 scale, for compact card display
  externalRatings: ExternalRating[]; // full breakdown of every rating the provider actually returned
  genres: string[];
  numberOfSeasons: number | null;
  isMockData?: boolean;
}

export interface MediaProvider {
  id: MediaSource;
  search(query: string, signal?: AbortSignal): Promise<SearchResultItem[]>;
  getDetails(externalId: string, signal?: AbortSignal): Promise<FullDetails>;
}

export class ProviderRequestError extends Error {}
