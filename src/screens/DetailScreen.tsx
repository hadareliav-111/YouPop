import { useEffect, useState } from "react";
import type { EpisodeRef, WatchlistItem } from "../types";
import {
  getCachedEpisodes,
  getDetails,
  getEpisodes,
  isOmdbConfigured,
  type TvmazeEpisode,
} from "../lib/providers";
import { getNextEpisodeStatus, episodeLabel } from "../lib/episodeProgress";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";
import { getReleaseAvailability, formatComingLabel } from "../lib/availability";
import { ScreenHeader } from "../components/ScreenHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OverflowMenu } from "../components/OverflowMenu";
import { StarRating } from "../components/StarRating";
import { EpisodePicker } from "../components/ItemDetail/EpisodePicker";
import { Modal } from "../components/Modal";
import { WhereToWatch } from "../components/WhereToWatch";
import { ShareWithFriendsPicker, type AudienceMode } from "../components/ShareWithFriendsPicker";
import type { FriendEntry } from "../hooks/useFriends";
import { useSwipeBack } from "../hooks/useSwipeBack";

const STATUS_LABEL: Record<WatchlistItem["status"], string> = {
  want_to_watch: "Want to watch",
  currently_watching: "Currently watching",
  watched: "Watched",
};

interface DetailScreenProps {
  item: WatchlistItem;
  onBack: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<WatchlistItem>) => void;
  onMarkWatched: () => void;
  onMarkWantToWatch: () => void;
  onMarkCurrentlyWatching: () => void;
  onSetCurrentEpisode: (episode: EpisodeRef | null) => void;
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
  onSetCurrentEpisode,
  onSetRating,
  onDelete,
  isRecommended,
  onAddToRecommendations,
  friends,
  onSwipeActiveChange,
}: DetailScreenProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  // Seeded synchronously from the shared episodes cache (see
  // useNextEpisodes.ts's own comment on getCachedEpisodes for the full
  // rationale) — this screen fully unmounts/remounts on every Edit Save/
  // Cancel round trip (same as any push/pop in this app), and without this,
  // a currently-watching show's remount always started from "Loading
  // episodes…" for a frame even though this exact item's episodes were
  // already fetched moments ago by the previous mount of this same screen.
  const [episodes, setEpisodes] = useState<TvmazeEpisode[]>(() =>
    isCurrentlyWatchingTv ? getCachedEpisodes(item.externalSource, item.externalId) ?? [] : [],
  );
  const [episodesLoading, setEpisodesLoading] = useState(
    () => isCurrentlyWatchingTv && !getCachedEpisodes(item.externalSource, item.externalId),
  );

  useEffect(() => {
    if (!isCurrentlyWatchingTv) return;
    let cancelled = false;
    // Only flips to a visible loading state when nothing's cached yet — a
    // cache hit here would otherwise still cost one render at
    // episodesLoading=true (getEpisodes() resolves a microtask later even
    // on a hit) after having just seeded true above.
    if (!getCachedEpisodes(item.externalSource, item.externalId)) setEpisodesLoading(true);
    getEpisodes(item.externalSource, item.externalId).then((eps) => {
      if (cancelled) return;
      setEpisodes(eps);
      setEpisodesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isCurrentlyWatchingTv, item.externalSource, item.externalId]);

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

  const nextEpisodeStatus = isCurrentlyWatchingTv
    ? getNextEpisodeStatus(episodes, item.currentEpisode)
    : null;

  const isUpcoming =
    item.status === "want_to_watch" &&
    getReleaseAvailability(item.releaseDate) === "upcoming";

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
              {(item.externalRatings ?? []).length > 0 ? (
                <div className="item-detail__ratings">
                  {item.externalRatings.map((r) => (
                    <span className="item-detail__rating-chip" key={r.source}>
                      <strong>{r.value}</strong> {r.source}
                    </span>
                  ))}
                </div>
              ) : (
                item.externalRating !== null && (
                  <p className="item-detail__rating">★ {item.externalRating.toFixed(1)}</p>
                )
              )}
              <WhereToWatch externalSource={item.externalSource} externalId={item.externalId} />
            </div>
          </div>

          {item.status !== "want_to_watch" && (
            <section className="detail-section">
              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={handleAddToRecommendationsClick}
                disabled={isRecommended}
              >
                {isRecommended ? "✓ In Recommendations" : "+ Add to Recommendations"}
              </button>
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

          <section className="detail-section">
            <h3 className="detail-section__title">Status</h3>

            {item.mediaType === "movie" ? (
              <>
                <p className="item-detail__status">{STATUS_LABEL[item.status]}</p>
                {item.status === "want_to_watch" && (
                  <button type="button" className="btn btn--primary btn--block" onClick={onMarkWatched}>
                    Mark as watched
                  </button>
                )}
                {item.status === "watched" && (
                  <>
                    <div className="item-detail__rating-row">
                      <span>My rating:</span>
                      <StarRating value={item.personalRating} onChange={onSetRating} />
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--block"
                      onClick={onMarkWantToWatch}
                    >
                      Mark as want to watch
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="segmented status-segmented">
                  <button
                    type="button"
                    className={`segmented__option ${item.status === "want_to_watch" ? "is-active" : ""}`}
                    onClick={onMarkWantToWatch}
                  >
                    Want to watch
                  </button>
                  <button
                    type="button"
                    className={`segmented__option ${item.status === "currently_watching" ? "is-active" : ""}`}
                    onClick={onMarkCurrentlyWatching}
                  >
                    Watching
                  </button>
                  <button
                    type="button"
                    className={`segmented__option ${item.status === "watched" ? "is-active" : ""}`}
                    onClick={onMarkWatched}
                  >
                    Watched
                  </button>
                </div>

                {item.status === "watched" && (
                  <div className="item-detail__rating-row">
                    <span>My rating:</span>
                    <StarRating value={item.personalRating} onChange={onSetRating} />
                  </div>
                )}

                {isCurrentlyWatchingTv && !pickerOpen && (
                  <div className="episode-progress">
                    <p className="episode-progress__current">
                      Last watched: <strong>{episodeLabel(item.currentEpisode)}</strong>
                    </p>
                    {episodesLoading && <p className="text-muted">Loading episodes…</p>}
                    {!episodesLoading && nextEpisodeStatus && (
                      <>
                        {nextEpisodeStatus.episode ? (
                          <p className="episode-progress__next">
                            Next: <strong>S{nextEpisodeStatus.episode.season} E{nextEpisodeStatus.episode.number}</strong>
                            {" — "}
                            <span className={`episode-progress__badge episode-progress__badge--${nextEpisodeStatus.availability}`}>
                              {nextEpisodeStatus.label}
                              {nextEpisodeStatus.exactDate ? ` · ${nextEpisodeStatus.exactDate}` : ""}
                            </span>
                          </p>
                        ) : (
                          <p className="text-muted">No upcoming episode.</p>
                        )}
                        {nextEpisodeStatus.episode && (
                          <button
                            type="button"
                            className="btn btn--primary btn--block"
                            onClick={() =>
                              onSetCurrentEpisode({
                                season: nextEpisodeStatus.episode!.season,
                                number: nextEpisodeStatus.episode!.number,
                              })
                            }
                          >
                            Mark S{nextEpisodeStatus.episode.season} E{nextEpisodeStatus.episode.number} as watched
                          </button>
                        )}
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setPickerOpen(true)}
                        >
                          I've watched up to...
                        </button>
                      </>
                    )}
                  </div>
                )}

                {isCurrentlyWatchingTv && pickerOpen && (
                  <EpisodePicker
                    episodes={episodes}
                    current={item.currentEpisode}
                    onSelect={(ep) => {
                      onSetCurrentEpisode(ep);
                      setPickerOpen(false);
                    }}
                    onCancel={() => setPickerOpen(false)}
                  />
                )}
              </>
            )}
          </section>
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
