// Core data model for the watchlist app.
// Kept flat and JSON-serializable so it can migrate to a cloud DB later
// (e.g. each WatchlistItem becomes a document/row keyed by `id`).

export type MediaType = "movie" | "tv";

// Reality is a TV subtype, not a separate top-level category — it's still
// fully filterable/identifiable via this field.
export type TvSubtype = "scripted" | "reality";

// Kept in sync with lib/providers/types.ts MediaSource — duplicated here
// (rather than imported) so this file has no dependency on the provider
// layer, which may change independently.
export type MediaSource = "tvmaze" | "omdb" | "mock-movie";

// One rating from one named source (IMDb, Rotten Tomatoes, Metacritic,
// TVmaze...) — see lib/providers/types.ts for the full rationale.
export interface ExternalRating {
  source: string;
  value: string;
}

export type WatchStatus = "want_to_watch" | "currently_watching" | "watched";

// A pointer to a specific episode within a show's TVmaze episode list.
export interface EpisodeRef {
  season: number;
  number: number;
}

export interface WatchlistItem {
  id: string; // internal uuid, stable even if externalId scheme changes
  externalId: string; // id within externalSource's own id space
  externalSource: MediaSource;
  title: string;
  mediaType: MediaType;
  tvSubtype: TvSubtype | null; // null for movies; "scripted" or "reality" for tv
  releaseYear: number | null;
  // Precise release/premiere date as "YYYY-MM-DD", when the provider gives
  // one (OMDb's "Released", TVmaze's "premiered") — null if unknown. This
  // is what drives the "upcoming vs available now" availability concept;
  // releaseYear stays purely for display and is kept separately rather
  // than derived, since older saved items may have a year but no exact
  // date.
  releaseDate: string | null;
  posterUrl: string | null;
  genres: string[];
  overview: string;
  externalRating: number | null; // primary rating, 0-10 scale, for compact card display
  externalRatings: ExternalRating[]; // full breakdown of every rating the provider returned
  numberOfSeasons: number | null; // tv only

  status: WatchStatus;
  personalRating: number | null; // 1-5, only set once watched

  // Last episode the user has watched, for tv items being actively
  // followed. Null means "not started" (next episode is S1E1). Advances
  // automatically as episodes are marked watched; can also be bulk-set via
  // "I've watched up to...".
  currentEpisode: EpisodeRef | null;

  isRecommendation: boolean;
  recommendedBy: string | null;
  recommendationNote: string | null; // "What did they say?" — only meaningful when isRecommendation

  personalNotes: string | null; // free-text notes, independent of recommendation, available on every item

  personalTags: string[];

  // Manual "how much I want to watch this" position, scoped within this
  // item's own mediaType category (movies rank against movies, tv against
  // tv) so reordering one category never touches another's order. Lower
  // sorts first. New items get appended (max existing + 1 within category).
  sortOrder: number;

  dateAdded: string; // ISO timestamp
  dateWatched: string | null; // ISO timestamp
}

// Shape used while the user is building a new item, before it's saved.
export interface NewItemDraft {
  isRecommendation: boolean;
  recommendedBy: string;
  recommendationNote: string;
  personalNotes: string;
  personalTags: string[];
}

export const EXPORT_SCHEMA_VERSION = 2;

export interface ExportedData {
  schemaVersion: number;
  exportedAt: string;
  items: WatchlistItem[];
}

// A user's own separate, private, ordered list of titles they want to
// recommend to others — NOT the same concept as WatchlistItem's
// isRecommendation/recommendedBy/recommendationNote (which record "someone
// recommended *this to me*"). Deliberately has no personal rating, tags,
// watch status, or episode tracking — this is its own collection, not a
// filtered view of the watchlist.
export interface Recommendation {
  id: string;
  externalId: string;
  externalSource: MediaSource;
  mediaType: MediaType;
  tvSubtype: TvSubtype | null;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  genres: string[];
  overview: string;
  externalRating: number | null;
  externalRatings: ExternalRating[];
  numberOfSeasons: number | null;
  note: string | null;
  // Manual order, scoped per user (not per mediaType — this is one flat
  // list) — this is what a future Friends feature would show recommendations
  // in, so it's persisted from day one even though nothing reads it that
  // way yet.
  sortOrder: number;
  dateAdded: string; // ISO timestamp
  // Explicit, stored sharing mode — "all" means every current *and
  // future* accepted friend; "selected" means only the friendships with
  // no row in recommendation_hidden_friends. Deliberately a real column,
  // not inferred from whether any hidden-friend rows exist: a "selected"
  // recommendation with every current friend individually checked has
  // zero hidden rows too, which would be indistinguishable from "all"
  // (and would wrongly grant a later-added friend access) if this were
  // inferred instead of stored.
  audience: "all" | "selected";
}

// Shape used while the user is building a new recommendation, before it's
// saved — deliberately just a note, nothing else.
export interface NewRecommendationDraft {
  note: string;
}

// One row per relationship *or* pending request between two users — status
// distinguishes them. No public profiles/discovery: this is only ever
// created via an exact username lookup, and only ever visible to the two
// people involved (see supabase/schema.sql RLS).
export type FriendshipStatus = "pending" | "accepted";

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string; // ISO timestamp
  respondedAt: string | null; // ISO timestamp, set on accept
}

// The minimal shape a poster tile actually needs — both ReorderableGrid
// (drag-reorder) and PosterRail/RailTile (horizontal rails) only ever read
// these three fields, so both WatchlistItem and Recommendation satisfy it
// structurally with no extra mapping.
export interface PosterEntry {
  id: string;
  posterUrl: string | null;
  title: string;
}
