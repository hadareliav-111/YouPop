import type { WatchlistItem } from "../types";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";
import { getReleaseAvailability, formatComingLabel } from "../lib/availability";

const STATUS_LABEL: Record<WatchlistItem["status"], string> = {
  want_to_watch: "Want to watch",
  currently_watching: "Watching",
  watched: "Watched",
};

interface ItemCardProps {
  item: WatchlistItem;
  onClick: () => void;
  // Set true only by screens that can be a swipe-back destination/backdrop
  // (see App.tsx's renderSwipeBackdrop). Their posters get destroyed and
  // recreated fresh on every navigation handoff, and a brand-new
  // <img loading="lazy" decoding="async"> isn't guaranteed to paint its
  // (already browser-cached) bitmap in the same frame it's inserted — that
  // gap was the post-swipe image flicker. Default (false/omitted) leaves
  // every other usage exactly as before.
  eager?: boolean;
}

export function ItemCard({ item, onClick, eager }: ItemCardProps) {
  const isUpcoming =
    item.status === "want_to_watch" &&
    getReleaseAvailability(item.releaseDate) === "upcoming";

  // Want to Watch is the implied default status everywhere this card's
  // status badge could otherwise say it (Movies/TV Shows' "See all" is the
  // only place ItemCard ever renders a want_to_watch item), so the badge
  // itself is redundant there — the recommendation badge (if any) takes
  // over its bottom-left slot instead, rather than the two badges
  // occupying separate corners. Watching/Watched keep both badges exactly
  // as before.
  const useStatusSlotForRecBadge = item.status === "want_to_watch";

  return (
    <button type="button" className="item-card" onClick={onClick}>
      <div className="item-card__poster-wrap">
        {item.posterUrl ? (
          <img
            className="item-card__poster"
            src={item.posterUrl}
            alt=""
            loading={eager ? undefined : "lazy"}
            decoding={eager ? undefined : "async"}
          />
        ) : (
          <div className="item-card__poster item-card__poster--placeholder">
            🎬
          </div>
        )}
        {!useStatusSlotForRecBadge && (
          <span
            className={`item-card__status-badge item-card__status-badge--${item.status}`}
          >
            {STATUS_LABEL[item.status]}
          </span>
        )}
        {item.isRecommendation &&
          (item.recommendedBy ? (
            <span
              className={`item-card__recommender-badge${useStatusSlotForRecBadge ? " item-card__recommender-badge--status-slot" : ""}`}
              title={`Recommended by ${item.recommendedBy}`}
            >
              From {item.recommendedBy}
            </span>
          ) : (
            <span
              className={`item-card__rec-badge${useStatusSlotForRecBadge ? " item-card__rec-badge--status-slot" : ""}`}
              title="Recommended"
            >
              ★ Rec
            </span>
          ))}
      </div>
      <div className="item-card__body">
        <h3 className="item-card__title">{item.title}</h3>
        <p className="item-card__meta">
          {mediaTypeLabel(item.mediaType, item.tvSubtype)}
          {item.releaseYear ? ` · ${item.releaseYear}` : ""}
        </p>
        {isUpcoming ? (
          <p className="item-card__coming">{formatComingLabel(item.releaseDate!)}</p>
        ) : (
          (item.genres ?? []).length > 0 && (
            <p className="item-card__genres">{item.genres.slice(0, 3).join(" · ")}</p>
          )
        )}
        <div className="item-card__footer">
          {item.status === "watched" && item.personalRating !== null && (
            <span className="item-card__rating" title="Your rating">
              {"★".repeat(item.personalRating)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
