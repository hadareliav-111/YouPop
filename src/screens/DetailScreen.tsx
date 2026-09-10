import { useEffect, useState } from "react";
import type { WatchlistItem } from "../types";
import { getDetails, isOmdbConfigured } from "../lib/providers";
import { episodeLabel } from "../lib/episodeProgress";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";
import { getReleaseAvailability, formatComingLabel } from "../lib/availability";
import { ScreenHeader } from "../components/ScreenHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OverflowMenu } from "../components/OverflowMenu";
import { StarRating } from "../components/StarRating";
import { Modal } from "../components/Modal";
import { WhereToWatch } from "../components/WhereToWatch";
import { ShareWithFriendsPicker, type AudienceMode } from "../components/ShareWithFriendsPicker";
import type { FriendEntry } from "../hooks/useFriends";
import { useSwipeBack } from "../hooks/useSwipeBack";

interface DetailScreenProps {
  item: WatchlistItem;
  onBack: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<WatchlistItem>) => void;
  onMarkWatched: () => void;
  onMarkWantToWatch: () => void;
  onMarkCurrentlyWatching: () => void;
  // Opens the dedicated Episode Progress screen — see EpisodeProgressScreen
  // for watched-progress/next-episode/"I've watched up to..." (moved there
  // in full so this screen stays a single compact page, never taller
  // because of episode data).
  onOpenEpisodeProgress: () => void;
  onSetRating: (rating: number | null) => void;
  onDelete: () => void;
  isRecommended: boolean;
  // hiddenFriendshipIds is [] for "All friends" — same audience-choice
  // contract as AddRecommendationScreen's onAdd. audience is passed
  // alongside it (not derived from hiddenFriendshipIds' length) since the
  // caller needs to store the explicit mode, not infer it.
  onAddToRecommendations: (audience: AudienceMode, hiddenFriendshipIds: string[]) => void;
  friends: FriendEntry[];
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

// Full page rather than a bottom-sheet modal, per the same reasoning as
// AddScreen — and it's what makes a genuinely centered delete-confirmation
// dialog (ConfirmDialog) possible, since the sheet-style Modal is anchored
// to the bottom edge by design.
export function DetailScreen({
  item,
  onBack,
  onEdit,
  onUpdate,
  onMarkWatched,
  onMarkWantToWatch,
  onMarkCurrentlyWatching,
  onOpenEpisodeProgress,
  onSetRating,
  onDelete,
  isRecommended,
  onAddToRecommendations,
  friends,
  onSwipeActiveChange,
}: DetailScreenProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Edge-swipe-to-go-back — see useSwipeBack's own comment for why it
  // can't collide with normal scrolling here (including the modal-touch
  // guard, which is what keeps this from firing under the delete
  // confirmation or the "Recommend to" modal below).
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  // "+ Add to Recommendations" audience choice — same {all|selected}
  // picker and contract as AddRecommendationScreen, just reached from a
  // Modal instead of being inline in a form, since this action starts from
  // a single button rather than a multi-step Add flow.
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [checkedFriendshipIds, setCheckedFriendshipIds] = useState<Set<string>>(new Set());

  const handleAddToRecommendationsClick = () => {
    if (friends.length === 0) {
      onAddToRecommendations("all", []);
      return;
    }
    setAudienceMode("all");
    setCheckedFriendshipIds(new Set());
    setAudienceModalOpen(true);
  };

  const handleAudienceModeChange = (mode: AudienceMode) => {
    if (mode === "selected" && audienceMode !== "selected") {
      setCheckedFriendshipIds(new Set());
    }
    setAudienceMode(mode);
  };

  const handleToggleAudienceFriend = (friendshipId: string) => {
    setCheckedFriendshipIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendshipId)) next.delete(friendshipId);
      else next.add(friendshipId);
      return next;
    });
  };

  const confirmAddToRecommendations = () => {
    const hiddenFriendshipIds =
      audienceMode === "all"
        ? []
        : friends.map((f) => f.friendshipId).filter((id) => !checkedFriendshipIds.has(id));
    onAddToRecommendations(audienceMode, hiddenFriendshipIds);
    setAudienceModalOpen(false);
  };
  const isCurrentlyWatchingTv = item.mediaType === "tv" && item.status === "currently_watching";

  // One-time backfill for TV shows saved before OMDb rating enrichment
  // existed (or saved when TVmaze had no rating yet): re-running
  // tvmaze.ts's getDetails() picks up its current IMDb/Rotten Tomatoes
  // enrichment (still by TVmaze's own exact imdb id, never title-matched)
  // and persists it onto the saved item so it displays from then on.
  // Keyed only on item.id/externalSource/externalId — not on
  // externalRatings — so this runs once per item per mount rather than
  // looping every time onUpdate below changes the item; the existing
  // session-lifetime details cache in providers/index.ts already prevents
  // this from costing a repeat OMDb request within the same session.
  useEffect(() => {
    if (item.mediaType !== "tv" || !isOmdbConfigured()) return;
    const alreadyEnriched = item.externalRatings.some((r) => r.source !== "TVmaze");
    if (alreadyEnriched) return;
    let cancelled = false;
    getDetails(item.externalSource, item.externalId)
      .then((details) => {
        if (cancelled || details.externalRatings.length === 0) return;
        onUpdate({
          externalRating: details.externalRating,
          externalRatings: details.externalRatings,
        });
      })
      .catch(() => {
        // Non-critical — the item already displays fine without this.
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.mediaType, item.externalSource, item.externalId]);

  const isUpcoming =
    item.status === "want_to_watch" &&
    getReleaseAvailability(item.releaseDate) === "upcoming";

  // This screen's ratings breakdown is IMDb/Rotten Tomatoes only, with no
  // fallback to anything else — item.externalRatings can also carry
  // Metacritic (OMDb) or "TVmaze" (TVmaze's own rating, used before/without
  // OMDb enrichment — see DetailScreen's own OMDb-backfill effect above),
  // and item.externalRating (the single primary number, used elsewhere for
  // card display) can itself just be TVmaze's own average for an
  // un-enriched TV show — neither belongs here. If neither IMDb nor Rotten
  // Tomatoes is available yet, no external rating shows at all rather than
  // falling back to one of those. Purely a display-time filter: the
  // underlying item/externalRatings data is unchanged, so card display and
  // everything else stays as-is.
  const detailRatings = (item.externalRatings ?? []).filter(
    (r) => r.source === "IMDb" || r.source === "Rotten Tomatoes",
  );

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader
        title={item.title}
        onBack={onBack}
        right={
          <OverflowMenu
            ariaLabel="More actions"
            items={[
              { label: "Delete", danger: true, onSelect: () => setConfirmingDelete(true) },
            ]}
          />
        }
      />

      <div className="app-screen__scroll">
        <div className="item-detail">
          <div className="item-detail__hero">
            {item.posterUrl ? (
              <img className="item-detail__poster" src={item.posterUrl} alt="" />
            ) : (
              <div className="item-detail__poster item-detail__poster--placeholder">
                🎬
              </div>
            )}
            <div className="item-detail__hero-info">
              <p className="item-detail__meta">
                {mediaTypeLabel(item.mediaType, item.tvSubtype)}
                {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                {item.mediaType !== "movie" && item.numberOfSeasons
                  ? ` · ${item.numberOfSeasons} season${item.numberOfSeasons > 1 ? "s" : ""}`
                  : ""}
              </p>
              {isUpcoming && (
                <p className="item-detail__coming">
                  📅 {formatComingLabel(item.releaseDate!)} — not released yet
                </p>
              )}
              {(item.genres ?? []).length > 0 && (
                <p className="item-detail__genres">{item.genres.join(" · ")}</p>
              )}
              {detailRatings.length > 0 && (
                <div className="item-detail__ratings">
                  {detailRatings.map((r) => (
                    <span className="item-detail__rating-chip" key={r.source}>
                      <strong>{r.value}</strong> {r.source}
                    </span>
                  ))}
                </div>
              )}
              <WhereToWatch externalSource={item.externalSource} externalId={item.externalId} />
            </div>
          </div>

          {item.mediaType === "movie" ? (
            // Same compact quick-actions structure/position as TV's (see
            // the TV branch below) — one section holding the compact Add
            // to Recommendations/In Recommendations button plus the status
            // selector, same handlers/conditions as before. Movies only
            // ever have two relevant statuses, so just those two options,
            // reusing the same orange/green --want_to_watch/--watched
            // color modifiers TV already defined.
            <section className="detail-section item-detail__quick-actions">
              {item.status !== "want_to_watch" && (
                <button
                  type="button"
                  className="btn btn--secondary btn--compact"
                  onClick={handleAddToRecommendationsClick}
                  disabled={isRecommended}
                >
                  {isRecommended ? "✓ In Recommendations" : "+ Add to Recommendations"}
                </button>
              )}

              <div className="segmented status-segmented status-segmented--compact">
                <button
                  type="button"
                  className={`segmented__option segmented__option--want_to_watch ${item.status === "want_to_watch" ? "is-active" : ""}`}
                  onClick={onMarkWantToWatch}
                >
                  Want to watch
                </button>
                <button
                  type="button"
                  className={`segmented__option segmented__option--watched ${item.status === "watched" ? "is-active" : ""}`}
                  onClick={onMarkWatched}
                >
                  Watched
                </button>
              </div>
            </section>
          ) : (
            // TV's quick-actions area: a compact Add to Recommendations/In
            // Recommendations button plus the Want to Watch/Watching/Watched
            // selector (moved up from the old Status section below, which no
            // longer exists for TV — see its own comment further down), so
            // this doesn't push the page's real content further down the
            // screen. Same handlers/conditions as before, just relocated and
            // restyled compact instead of full-width.
            <section className="detail-section item-detail__quick-actions">
              {item.status !== "want_to_watch" && (
                <button
                  type="button"
                  className="btn btn--secondary btn--compact"
                  onClick={handleAddToRecommendationsClick}
                  disabled={isRecommended}
                >
                  {isRecommended ? "✓ In Recommendations" : "+ Add to Recommendations"}
                </button>
              )}

              <div className="segmented status-segmented status-segmented--compact">
                <button
                  type="button"
                  className={`segmented__option segmented__option--want_to_watch ${item.status === "want_to_watch" ? "is-active" : ""}`}
                  onClick={onMarkWantToWatch}
                >
                  Want to watch
                </button>
                <button
                  type="button"
                  className={`segmented__option segmented__option--currently_watching ${item.status === "currently_watching" ? "is-active" : ""}`}
                  onClick={onMarkCurrentlyWatching}
                >
                  Watching
                </button>
                <button
                  type="button"
                  className={`segmented__option segmented__option--watched ${item.status === "watched" ? "is-active" : ""}`}
                  onClick={onMarkWatched}
                >
                  Watched
                </button>
              </div>

              {isCurrentlyWatchingTv && (
                <div className="detail-section__header">
                  <p className="text-muted">
                    Episode Progress ·{" "}
                    {item.currentEpisode
                      ? `Last Watched: ${episodeLabel(item.currentEpisode)}`
                      : "Not Started"}
                  </p>
                  <button type="button" className="link-btn" onClick={onOpenEpisodeProgress}>
                    Manage ›
                  </button>
                </div>
              )}
            </section>
          )}

          {item.overview && (
            <section className="detail-section">
              <h3 className="detail-section__title">Overview</h3>
              <p className="item-detail__overview">{item.overview}</p>
            </section>
          )}

          <section className="detail-section">
            <div className="detail-section__header">
              <h3 className="detail-section__title">Details</h3>
              <button type="button" className="link-btn" onClick={onEdit}>
                Edit
              </button>
            </div>

            {item.isRecommendation ? (
              <div className="recommendation-box">
                {item.recommendedBy && (
                  <span className="recommend-chip">
                    Recommended by {item.recommendedBy}
                  </span>
                )}
                {item.recommendationNote && (
                  <p className="recommendation-box__note">
                    "{item.recommendationNote}"
                  </p>
                )}
                {!item.recommendedBy && !item.recommendationNote && (
                  <p className="text-muted">This is a recommendation.</p>
                )}
              </div>
            ) : (
              <p className="text-muted">Not a recommendation.</p>
            )}

            {item.personalNotes && (
              <p className="item-detail__notes item-detail__notes--in-details">
                {item.personalNotes}
              </p>
            )}
          </section>

          {/* Both mediaTypes' status *switching* now lives in the compact
              segmented selector above (unchanged handlers, just restyled/
              relocated) — the "Mark as watched"/"Mark as want to watch"
              buttons and plain status label that used to live here are
              gone as redundant. Movies' personal rating is untouched and
              still lives here, unaffected by that; TV never had one. */}
          {item.mediaType === "movie" && item.status === "watched" && (
            <section className="detail-section">
              <h3 className="detail-section__title">Status</h3>
              <div className="item-detail__rating-row">
                <span>My rating:</span>
                <StarRating value={item.personalRating} onChange={onSetRating} />
              </div>
            </section>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete item?"
          message={`Delete "${item.title}" from your watchlist?`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={onDelete}
        />
      )}

      {audienceModalOpen && (
        <Modal title="Recommend to" onClose={() => setAudienceModalOpen(false)}>
          <div className="details-form">
            <ShareWithFriendsPicker
              friends={friends}
              mode={audienceMode}
              checkedFriendshipIds={checkedFriendshipIds}
              onModeChange={handleAudienceModeChange}
              onToggleFriend={handleToggleAudienceFriend}
              onSelectAll={() => setCheckedFriendshipIds(new Set(friends.map((f) => f.friendshipId)))}
              onClearAll={() => setCheckedFriendshipIds(new Set())}
            />
            <div className="details-form__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setAudienceModalOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmAddToRecommendations}>
                Add Recommendation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
