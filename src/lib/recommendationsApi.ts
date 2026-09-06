import type { Recommendation } from "../types";
import { normalizeSortOrders } from "./storage";
import { supabase } from "./supabaseClient";

const TABLE = "recommendations";

// Row shape as it actually comes back from Postgres (snake_case). Only used
// internally to this file — everything above this module speaks
// `Recommendation` (camelCase), same convention as watchlistApi.ts.
interface RecommendationRow {
  id: string;
  external_id: string;
  external_source: Recommendation["externalSource"];
  media_type: Recommendation["mediaType"];
  tv_subtype: Recommendation["tvSubtype"];
  title: string;
  poster_url: string | null;
  release_year: number | null;
  genres: string[];
  overview: string;
  external_rating: number | null;
  external_ratings: Recommendation["externalRatings"];
  number_of_seasons: number | null;
  note: string | null;
  sort_order: number;
  date_added: string;
}

function fromRow(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    externalId: row.external_id,
    externalSource: row.external_source,
    mediaType: row.media_type,
    tvSubtype: row.tv_subtype,
    title: row.title,
    posterUrl: row.poster_url,
    releaseYear: row.release_year,
    genres: Array.isArray(row.genres) ? row.genres : [],
    overview: row.overview ?? "",
    externalRating: row.external_rating,
    externalRatings: Array.isArray(row.external_ratings) ? row.external_ratings : [],
    numberOfSeasons: row.number_of_seasons,
    note: row.note,
    sortOrder: row.sort_order,
    dateAdded: row.date_added,
  };
}

function toRow(rec: Recommendation, userId: string) {
  return {
    id: rec.id,
    user_id: userId,
    external_id: rec.externalId,
    external_source: rec.externalSource,
    media_type: rec.mediaType,
    tv_subtype: rec.tvSubtype,
    title: rec.title,
    poster_url: rec.posterUrl,
    release_year: rec.releaseYear,
    genres: rec.genres,
    overview: rec.overview,
    external_rating: rec.externalRating,
    external_ratings: rec.externalRatings,
    number_of_seasons: rec.numberOfSeasons,
    note: rec.note,
    sort_order: rec.sortOrder,
    date_added: rec.dateAdded,
  };
}

export async function fetchAll(userId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  // Same re-sequencing safety net Watchlist's fetch already has — tolerant
  // of any gaps/duplicates in the raw sort_order values, rather than
  // trusting a SQL-level `order by` (which gives Postgres no tie-breaker
  // for equal values, and previously left this list vulnerable to an order
  // that could differ between fetches).
  return normalizeSortOrders((data as RecommendationRow[]).map(fromRow));
}

export async function insertOne(userId: string, rec: Recommendation): Promise<void> {
  const { error } = await supabase.from(TABLE).insert(toRow(rec, userId));
  if (error) throw error;
}

export async function updateNote(userId: string, id: string, note: string | null): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ note })
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

// One small update per moved item — not a hot path (a user reorders a
// handful of recommendations at a time), so a Promise.all of individual
// updates is simple and fine, same approach as watchlistApi.reorder. Each
// result's `error` is checked — a Supabase query resolves rather than
// throws on a database-level failure, so skipping this would let a failed
// reorder silently look like it succeeded (the exact bug this fixes).
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
