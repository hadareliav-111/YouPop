import { useState } from "react";
import type { Recommendation, WatchStatus } from "../types";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";
import { ScreenHeader } from "../components/ScreenHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OverflowMenu } from "../components/OverflowMenu";
import { WhereToWatch } from "../components/WhereToWatch";
import type { FriendEntry } from "../hooks/useFriends";
import { useSwipeBack } from "../hooks/useSwipeBack";

interface RecommendationDetailScreenProps {
  recommendation: Recommendation;
  onBack: () => void;
  onDelete?: () => void;
  // Editing itself happens on a separate pushed screen
  // (RecommendationNoteScreen) — onEditNote just triggers that
  // navigation, same pattern as onEditSharing below.
  onEditNote?: () => void;
  // True when viewing a friend's recommendation via Friends' Recommendations
  // — there's nothing to edit or delete on someone else's row (RLS would
  // reject it anyway), so those affordances are simply not offered.
  readOnly?: boolean;
  // Friends' Recommendations-only — the user's own Recommendations flow
  // never passes these, so nothing changes there. null/undefined means
  // "not in the Watchlist at all" — the actual status (not just a boolean)
  // is what lets the disabled indicator say "✓ Watched" instead of a
  // generic "✓ In Watchlist" right after the user clicks Watched.
  watchlistStatus?: WatchStatus | null;
  onAddToWatchlist?: () => void;
  onMarkWatched?: () => void;
  // Sharing controls — only ever passed for the user's own Recommendations
  // (never together with readOnly), so the "Shared with" section is simply
  // absent everywhere else. Editing itself happens on a separate pushed
  // screen (RecommendationSharingScreen) — onEditSharing just triggers
  // that navigation, keeping this page's own height fixed regardless of
  // friend-list length.
  friends?: FriendEntry[];
  hiddenFriendshipIds?: Set<string>;
  onEditSharing?: () => void;
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

// Reuses the same visual language as the Watchlist's DetailScreen (same
// ScreenHeader, .item-detail/.detail-section CSS, ConfirmDialog for delete)
// so it looks and feels like the same screen — but scoped to exactly what a
// Recommendation has: hero facts about the movie/show, Overview, and a
// single editable Note. No status, episode tracking, personal rating, tags,
// or the Watchlist's separate "who recommended this to me" section.
export function RecommendationDetailScreen({
  recommendation,
  onBack,
  onDelete,
  onEditNote,
  readOnly = false,
  watchlistStatus,
  onAddToWatchlist,
  onMarkWatched,
  friends,
  hiddenFriendshipIds,
  onEditSharing,
  onSwipeActiveChange,
}: RecommendationDetailScreenProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const showSharing = !readOnly && friends && friends.length > 0 && onEditSharing;
  const currentHidden = hiddenFriendshipIds ?? new Set<string>();

  // Edge-swipe-to-go-back — covers both the user's own recommendation
  // detail and a friend's (readOnly) recommendation detail, since both
  // render through this same component. See useSwipeBack's own comment
  // for why it can't collide with normal scrolling here (including the
  // modal-touch guard, which is what keeps this from firing under the
  // delete confirmation dialog).
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader
        title={recommendation.title}
        onBack={onBack}
        right={
          readOnly ? undefined : (
            <OverflowMenu
              ariaLabel="More actions"
              items={[
                { label: "Delete", danger: true, onSelect: () => setConfirmingDelete(true) },
              ]}
            />
          )
        }
      />

      <div className="app-screen__scroll">
        <div className="item-detail">
          <div className="item-detail__hero">
            {recommendation.posterUrl ? (
              <img className="item-detail__poster" src={recommendation.posterUrl} alt="" />
            ) : (
              <div className="item-detail__poster item-detail__poster--placeholder">
                🎬
              </div>
            )}
            <div className="item-detail__hero-info">
              <p className="item-detail__meta">
                {mediaTypeLabel(recommendation.mediaType, recommendation.tvSubtype)}
                {recommendation.releaseYear ? ` · ${recommendation.releaseYear}` : ""}
                {recommendation.mediaType !== "movie" && recommendation.numberOfSeasons
                  ? ` · ${recommendation.numberOfSeasons} season${recommendation.numberOfSeasons > 1 ? "s" : ""}`
                  : ""}
              </p>
              {(recommendation.genres ?? []).length > 0 && (
                <p className="item-detail__genres">{recommendation.genres.join(" · ")}</p>
              )}
              {(recommendation.externalRatings ?? []).length > 0 ? (
                <div className="item-detail__ratings">
                  {recommendation.externalRatings.map((r) => (
                    <span className="item-detail__rating-chip" key={r.source}>
                      <strong>{r.value}</strong> {r.source}
                    </span>
                  ))}
                </div>
              ) : (
                recommendation.externalRating !== null && (
                  <p className="item-detail__rating">★ {recommendation.externalRating.toFixed(1)}</p>
                )
              )}
              <WhereToWatch
                externalSource={recommendation.externalSource}
                externalId={recommendation.externalId}
              />
            </div>
          </div>

          {(onAddToWatchlist || onMarkWatched) && (
            <section className="detail-section">
              {watchlistStatus ? (
                <button type="button" className="btn btn--secondary btn--block" disabled>
                  {watchlistStatus === "watched" ? "✓ Watched" : "✓ In Watchlist"}
                </button>
              ) : (
                <div className="recommendation-detail__watchlist-actions">
                  {onAddToWatchlist && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--block"
                      onClick={onAddToWatchlist}
                    >
                      + Add to Watchlist
                    </button>
                  )}
                  {onMarkWatched && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--block"
                      onClick={onMarkWatched}
                    >
                      Watched
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {recommendation.overview && (
            <section className="detail-section">
              <h3 className="detail-section__title">Overview</h3>
              <p className="item-detail__overview">{recommendation.overview}</p>
            </section>
          )}

          <section className="detail-section">
            <div className="detail-section__header">
              <h3 className="detail-section__title">Note</h3>
              {!readOnly && onEditNote && (
                <button type="button" className="link-btn" onClick={onEditNote}>
                  Edit
                </button>
              )}
            </div>

            {recommendation.note ? (
              <p className="item-detail__notes">{recommendation.note}</p>
            ) : (
              <p className="text-muted">No note yet.</p>
            )}
          </section>

          {showSharing && (
            <section className="detail-section">
              <div className="detail-section__header">
                <h3 className="detail-section__title">Shared with</h3>
                <button type="button" className="link-btn" onClick={onEditSharing}>
                  Edit
                </button>
              </div>

              <p className="text-muted">
                {recommendation.audience === "all"
                  ? "All friends"
                  : (friends ?? [])
                      .filter((f) => !currentHidden.has(f.friendshipId))
                      .map((f) => f.username)
                      .join(", ") || "No one"}
              </p>

              {recommendation.audience === "all" && (
                <p className="text-muted audience-picker__hint">
                  New friends will automatically see this recommendation.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete recommendation?"
          message={`Remove "${recommendation.title}" from your recommendations?`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => onDelete?.()}
        />
      )}
    </div>
  );
}
