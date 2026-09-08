import type { Recommendation, WatchStatus } from "../types";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onClick: () => void;
  // Used only by Friends' Recommendations — the user's own Recommendations
  // list never passes this.
  isNew?: boolean;
  // Also Friends' Recommendations-only — lets the user add a friend's
  // recommendation straight to their own Watchlist (as Want to Watch, or
  // directly as Watched) without opening the detail screen. Omitted
  // entirely for the user's own Recommendations, so that list's cards
  // render exactly as before. null/undefined means "not in the Watchlist
  // at all" — the actual status (not just a boolean) is what lets the
  // disabled indicator say "✓ Watched" instead of a generic "✓ In
  // Watchlist" right after the user clicks Watched.
  watchlistStatus?: WatchStatus | null;
  onAddToWatchlist?: () => void;
  onMarkWatched?: () => void;
  // Set true only by screens that can be a swipe-back destination/backdrop
  // (see App.tsx's renderSwipeBackdrop). Their posters get destroyed and
  // recreated fresh on every navigation handoff, and a brand-new
  // <img loading="lazy" decoding="async"> isn't guaranteed to paint its
  // (already browser-cached) bitmap in the same frame it's inserted — that
  // gap was the post-swipe image flicker. Default (false/omitted) leaves
  // every other usage exactly as before.
  eager?: boolean;
}

// Deliberately simpler than ItemCard — no status badge, no rating footer,
// no recommender badge, since a Recommendation has none of that.
export function RecommendationCard({
  recommendation,
  onClick,
  isNew,
  watchlistStatus,
  onAddToWatchlist,
  onMarkWatched,
  eager,
}: RecommendationCardProps) {
  return (
    <div className="item-card">
      <button type="button" className="item-card__hit" onClick={onClick}>
        <div className="item-card__poster-wrap">
          {recommendation.posterUrl ? (
            <img
              className="item-card__poster"
              src={recommendation.posterUrl}
              alt=""
              loading={eager ? undefined : "lazy"}
              decoding={eager ? undefined : "async"}
            />
          ) : (
            <div className="item-card__poster item-card__poster--placeholder">🎬</div>
          )}
          {isNew && <span className="item-card__new-badge">NEW</span>}
        </div>
        <div className="item-card__body">
          <h3 className="item-card__title">{recommendation.title}</h3>
          <p className="item-card__meta">
            {mediaTypeLabel(recommendation.mediaType, recommendation.tvSubtype)}
            {recommendation.releaseYear ? ` · ${recommendation.releaseYear}` : ""}
          </p>
        </div>
      </button>
      {(onAddToWatchlist || onMarkWatched) && (
        <div className="item-card__watchlist-actions">
          {watchlistStatus ? (
            <button type="button" className="item-card__add-watchlist-btn" disabled>
              {watchlistStatus === "watched" ? "✓ Watched" : "✓ In Watchlist"}
            </button>
          ) : (
            <>
              {onAddToWatchlist && (
                <button
                  type="button"
                  className="item-card__add-watchlist-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToWatchlist();
                  }}
                >
                  + Add to Watchlist
                </button>
              )}
              {onMarkWatched && (
                <button
                  type="button"
                  className="item-card__watched-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkWatched();
                  }}
                >
                  Watched
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
