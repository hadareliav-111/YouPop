import type { Recommendation, WatchlistItem, WatchStatus } from "../types";

// Shared match predicate — a recommendation and a Watchlist item refer to
// the same title iff they share externalSource+externalId, exactly like
// useWatchlist's own alreadyAdded() check.
function findWatchlistMatch(
  recommendation: Recommendation,
  watchlistItems: WatchlistItem[],
): WatchlistItem | undefined {
  return watchlistItems.find(
    (item) =>
      item.externalSource === recommendation.externalSource &&
      item.externalId === recommendation.externalId,
  );
}

// True unless the viewer's own Watchlist already has this exact title
// marked Watched or Currently Watching. Not in the Watchlist at all still
// counts as "not watched" — there's simply nothing to exclude it.
export function isNotWatched(
  recommendation: Recommendation,
  watchlistItems: WatchlistItem[],
): boolean {
  const match = findWatchlistMatch(recommendation, watchlistItems);
  if (!match) return true;
  return match.status !== "watched" && match.status !== "currently_watching";
}

// The viewer's own Watchlist status for this recommendation, or null if
// it isn't in their Watchlist at all. Used both to gate the "+ Add to
// Watchlist"/"Watched" actions on a friend's recommendation (so they can
// never create a duplicate) and to label the resulting disabled indicator
// correctly ("✓ Watched" vs "✓ In Watchlist") — a plain boolean isn't
// enough for that, since "in the watchlist" doesn't say which status it's
// actually in.
export function getWatchlistStatus(
  recommendation: Recommendation,
  watchlistItems: WatchlistItem[],
): WatchStatus | null {
  return findWatchlistMatch(recommendation, watchlistItems)?.status ?? null;
}
