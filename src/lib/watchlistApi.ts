import type { WatchlistItem } from "../types";
import { normalizeItem, normalizeSortOrders } from "./storage";
import { supabase } from "./supabaseClient";

const TABLE = "watchlist_items";

// Row shape as it actually comes back from Postgres (snake_case). Only used
// internally to this file — everything above this module speaks
// `WatchlistItem` (camelCase), exactly as it always has.
interface WatchlistRow {
  id: string;
  external_id: string;
  external_source: WatchlistItem["externalSource"];
  title: string;
  media_type: WatchlistItem["mediaType"];
  tv_subtype: WatchlistItem["tvSubtype"];
  release_year: number | null;
  release_date: string | null;
  poster_url: string | null;
  genres: string[];
  overview: string;
  external_rating: number | null;
  external_ratings: WatchlistItem["externalRatings"];
  number_of_seasons: number | null;
  status: WatchlistItem["status"];
  personal_rating: number | null;
  current_episode: WatchlistItem["currentEpisode"];
  is_recommendation: boolean;
  recommended_by: string | null;
  recommendation_note: string | null;
  personal_notes: string | null;
  personal_tags: string[];
  sort_order: number;
  date_added: string;
  date_watched: string | null;
}

function fromRow(row: WatchlistRow): WatchlistItem {
  // Routed through the same normalizer localStorage loads use — one shared
  // definition of "safe defaults for a WatchlistItem," regardless of source.
  return normalizeItem({
    id: row.id,
    externalId: row.external_id,
    externalSource: row.external_source,
    title: row.title,
    mediaType: row.media_type,
    tvSubtype: row.tv_subtype,
    releaseYear: row.release_year,
    releaseDate: row.release_date,
    posterUrl: row.poster_url,
    genres: row.genres,
    overview: row.overview,
    externalRating: row.external_rating,
    externalRatings: row.external_ratings,
    numberOfSeasons: row.number_of_seasons,
    status: row.status,
    personalRating: row.personal_rating,
    currentEpisode: row.current_episode,
    isRecommendation: row.is_recommendation,
    recommendedBy: row.recommended_by,
    recommendationNote: row.recommendation_note,
    personalNotes: row.personal_notes,
    personalTags: row.personal_tags,
    sortOrder: row.sort_order,
    dateAdded: row.date_added,
    dateWatched: row.date_watched,
  });
}

function toRow(item: WatchlistItem, userId: string) {
  return {
    id: item.id,
    user_id: userId,
    external_id: item.externalId,
    external_source: item.externalSource,
    title: item.title,
    media_type: item.mediaType,
    tv_subtype: item.tvSubtype,
    release_year: item.releaseYear,
    release_date: item.releaseDate,
    poster_url: item.posterUrl,
    genres: item.genres,
    overview: item.overview,
    external_rating: item.externalRating,
    external_ratings: item.externalRatings,
    number_of_seasons: item.numberOfSeasons,
    status: item.status,
    personal_rating: item.personalRating,
    current_episode: item.currentEpisode,
    is_recommendation: item.isRecommendation,
    recommended_by: item.recommendedBy,
    recommendation_note: item.recommendationNote,
    personal_notes: item.personalNotes,
    personal_tags: item.personalTags,
    sort_order: item.sortOrder,
    date_added: item.dateAdded,
    date_watched: item.dateWatched,
  };
}

// Only the fields a patch might actually touch — keeps `updatePatch` from
// having to know every column, and never overwrites a field the caller
// didn't mean to change.
const PATCH_KEY_MAP: Record<keyof WatchlistItem, string> = {
  id: "id",
  externalId: "external_id",
  externalSource: "external_source",
  title: "title",
  mediaType: "media_type",
  tvSubtype: "tv_subtype",
  releaseYear: "release_year",
  releaseDate: "release_date",
  posterUrl: "poster_url",
  genres: "genres",
  overview: "overview",
  externalRating: "external_rating",
  externalRatings: "external_ratings",
  numberOfSeasons: "number_of_seasons",
  status: "status",
  personalRating: "personal_rating",
  currentEpisode: "current_episode",
  isRecommendation: "is_recommendation",
  recommendedBy: "recommended_by",
  recommendationNote: "recommendation_note",
  personalNotes: "personal_notes",
  personalTags: "personal_tags",
  sortOrder: "sort_order",
  dateAdded: "date_added",
  dateWatched: "date_watched",
};

function toRowPatch(patch: Partial<WatchlistItem>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof WatchlistItem)[]) {
    row[PATCH_KEY_MAP[key]] = patch[key];
  }
  return row;
}

export async function fetchAll(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return normalizeSortOrders((data as WatchlistRow[]).map(fromRow), (item) => item.mediaType);
}

export async function insertOne(userId: string, item: WatchlistItem): Promise<void> {
  const { error } = await supabase.from(TABLE).insert(toRow(item, userId));
  if (error) throw error;
}

export async function insertMany(userId: string, items: WatchlistItem[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase
    .from(TABLE)
    .insert(items.map((item) => toRow(item, userId)));
  if (error) throw error;
}

export async function updatePatch(
  userId: string,
  id: string,
  patch: Partial<WatchlistItem>,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update(toRowPatch(patch))
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function remove(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// Used only by manual drag reorder — one small update per moved item. Not a
// hot path (a user reorders a handful of items at a time), so a Promise.all
// of individual updates is simple and fine; no batch/queue infra needed.
// Each result's `error` is checked (unlike a bare Promise.all of the calls
// themselves) — a Supabase query resolves rather than throws on a
// database-level failure, so skipping this would let a failed reorder
// silently look like it succeeded.
export async function reorder(userId: string, orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from(TABLE)
        .update({ sort_order: index })
        .eq("id", id)
        .eq("user_id", userId),
    ),
  );
  const failures = results.map((r) => r.error).filter((e) => e !== null);
  if (failures.length > 0) {
    throw new Error(
      `Failed to save the new order for ${failures.length} item(s): ${failures.map((e) => e.message).join("; ")}`,
    );
  }
}

// Only used by the explicit "Replace existing" import action — a rare,
// deliberate, whole-list operation, so delete-then-bulk-insert is simple and
// fine.
export async function replaceAll(userId: string, items: WatchlistItem[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
  await insertMany(userId, items);
}
