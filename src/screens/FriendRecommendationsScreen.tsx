import { useMemo, useState } from "react";
import type { WatchlistItem } from "../types";
import type { FriendRecommendation } from "../lib/friendsRecommendationsApi";
import { isNotWatched, getWatchlistStatus } from "../lib/watchStatus";
import { ScreenHeader } from "../components/ScreenHeader";
import { RecommendationCard } from "../components/RecommendationCard";
import { EmptyState } from "../components/EmptyState";
import { useSwipeBack } from "../hooks/useSwipeBack";

type FilterMode = "not_watched" | "all";

interface FriendRecommendationsScreenProps {
  username: string;
  recommendations: FriendRecommendation[];
  watchlistItems: WatchlistItem[];
  isNew: (recommendationId: string) => boolean;
  onBack: () => void;
  onSelect: (recommendation: FriendRecommendation) => void;
  onAddToWatchlist: (recommendation: FriendRecommendation) => void;
  onMarkWatched: (recommendation: FriendRecommendation) => void;
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

// The "See all" destination for one friend — a read-only grid, same
// RecommendationCard the user's own Recommendations screen already uses.
export function FriendRecommendationsScreen({
  username,
  recommendations,
  watchlistItems,
  isNew,
  onBack,
  onSelect,
  onAddToWatchlist,
  onMarkWatched,
  onSwipeActiveChange,
}: FriendRecommendationsScreenProps) {
  const [filter, setFilter] = useState<FilterMode>("not_watched");

  // Edge-swipe-to-go-back — see useSwipeBack's own comment for why it
  // can't collide with normal scrolling here.
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? recommendations
        : recommendations.filter((r) => isNotWatched(r, watchlistItems)),
    [recommendations, filter, watchlistItems],
  );

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader title={username} onBack={onBack} />

      <div className="category-screen__filter-tabs">
        <button
          type="button"
          className={`filter-tab ${filter === "not_watched" ? "is-active" : ""}`}
          onClick={() => setFilter("not_watched")}
        >
          Not Watched
        </button>
        <button
          type="button"
          className={`filter-tab ${filter === "all" ? "is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      <div className="app-screen__scroll">
        {filtered.length === 0 ? (
          <EmptyState icon="⭐" title="No recommendations" message="Nothing to show here." />
        ) : (
          <div className="watchlist-grid">
            {filtered.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                isNew={isNew(rec.id)}
                onClick={() => onSelect(rec)}
                watchlistStatus={getWatchlistStatus(rec, watchlistItems)}
                onAddToWatchlist={() => onAddToWatchlist(rec)}
                onMarkWatched={() => onMarkWatched(rec)}
                eager
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
