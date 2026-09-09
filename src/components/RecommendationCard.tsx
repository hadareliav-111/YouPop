import type { Recommendation } from "../types";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onClick: () => void;
  // Used only by Friends' Recommendations — the user's own Recommendations
  // list never passes this.
  isNew?: boolean;
  // Also Friends' Recommendations-only (FriendRecommendationsScreen's "See
  // all" grid) — shows a Genres line at the bottom, same style as
  // Watchlist cards. The user's own Recommendations list omits this and
  // renders exactly as it always has.
  showGenres?: boolean;
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
// no recommender badge, since a Recommendation has none of that. Adding to
// Watchlist / marking Watched for a friend's recommendation happens on its
// Recommendation Detail screen, not from this card.
export function RecommendationCard({
  recommendation,
  onClick,
  isNew,
  showGenres,
  eager,
}: RecommendationCardProps) {
  return (
    <button type="button" className="item-card" onClick={onClick}>
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
        {showGenres && (recommendation.genres ?? []).length > 0 && (
          <p className="item-card__genres">{recommendation.genres.slice(0, 3).join(" · ")}</p>
        )}
      </div>
    </button>
  );
}
