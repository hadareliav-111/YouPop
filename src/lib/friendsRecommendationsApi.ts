import type { Recommendation } from "../types";
import { normalizeSortOrders } from "./storage";
import { supabase } from "./supabaseClient";

const TABLE = "recommendations";
const VIEWS_TABLE = "recommendation_views";

// Row shape mirrors recommendationsApi.ts's RecommendationRow exactly —
// same table, just read here through the additive "accepted friends" RLS
// policy instead of the owner-only one.
interface RecommendationRow {
  id: string;
  user_id: string;
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
  audience: Recommendation["audience"];
}

export interface FriendRecommendation extends Recommendation {
  friendUserId: string;
}

function fromRow(row: RecommendationRow): FriendRecommendation {
  return {
    id: row.id,
    friendUserId: row.user_id,
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
    audience: row.audience,
  };
}

// One query for every friend at once — relies entirely on the "accepted
// friends" RLS policy for correctness; a stale/removed friend id here is
// silently filtered out by RLS, never returned.
export async function fetchForFriends(friendIds: string[]): Promise<FriendRecommendation[]> {
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .in("user_id", friendIds);
  if (error) throw error;
  // Re-sequences per friend (grouped by friendUserId) so each friend's own
  // manual order is preserved independently — same shared logic Watchlist/
  // Recommendations already use, just grouped by the owner instead of by
  // mediaType.
  return normalizeSortOrders(
    (data as RecommendationRow[]).map(fromRow),
    (r) => r.friendUserId,
  );
}

// The viewer's own "have I seen this" set — absence of an id here means
// "New" for this viewer.
export async function fetchViewedIds(viewerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from(VIEWS_TABLE)
    .select("recommendation_id")
    .eq("viewer_id", viewerId);
  if (error) throw error;
  return new Set((data as { recommendation_id: string }[]).map((r) => r.recommendation_id));
}

// Fire-and-forget from the caller's point of view — marks a batch of
// recommendations as seen for this viewer. `on conflict do nothing` since
// re-marking an already-viewed id is a harmless no-op, not an error.
export async function markViewed(viewerId: string, recommendationIds: string[]): Promise<void> {
  if (recommendationIds.length === 0) return;
  const { error } = await supabase
    .from(VIEWS_TABLE)
    .upsert(
      recommendationIds.map((id) => ({ recommendation_id: id, viewer_id: viewerId })),
      { onConflict: "recommendation_id,viewer_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}
