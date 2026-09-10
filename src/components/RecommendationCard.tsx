import type { Recommendation, WatchStatus } from "../types";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";

// Friends' Recommendations-only wording for the viewer's own Watchlist
// status — deliberately not ItemCard's own STATUS_LABEL map ("Want to
// watch"), since "In Watchlist" reads better for a tag on someone else's
// recommendation than a restatement of the status name itself.
const WATCHLIST_STATUS_LABEL: Record<WatchStatus, string> = {
  want_to_watch: "In Watchlist",
  currently_watching: "Watching",
  watched: "Watched",
};

interface RecommendationCardProps {
  recommendation: Recommendation;
  onClick: () => void;
  // Used only by Friends' Recommendations — the user's own Recommendations
  // list never passes this.
  isNew?: boolean;
  // Also Friends' Recommendations-only — the viewer's own Watchlist status
  // for this title (null if it isn't in their Watchlist at all), reusing
  // the same match logic Recommendation Detail already uses for its own
  // "✓ Watched"/"✓ In Watchlist" indicator (see lib/watchStatus.ts).
  // Renders no tag at all when omitted/null, so every other usage of this
  // card is visually unaffected. Rendered with its own
  // item-card__status-badge--rec-* color modifiers (see index.css) rather
  // than reusing ItemCard's --watched/--currently_watching ones, so tuning
  // this tag's colors can never also recolor ItemCard's own Watchlist
  // status badges.
  watchlistStatus?: WatchStatus | null;
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
  watchlistStatus,
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
        {watchlistStatus && (
          <span
            className={`item-card__status-badge item-card__status-badge--rec-${watchlistStatus}`}
          >
            {WATCHLIST_STATUS_LABEL[watchlistStatus]}
          </span>
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
