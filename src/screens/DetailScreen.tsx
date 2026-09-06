import { useEffect, useState } from "react";
import type { EpisodeRef, WatchlistItem } from "../types";
import { getDetails, getEpisodes, isOmdbConfigured, type TvmazeEpisode } from "../lib/providers";
import { getNextEpisodeStatus, episodeLabel } from "../lib/episodeProgress";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";
import { getReleaseAvailability, formatComingLabel } from "../lib/availability";
import { ScreenHeader } from "../components/ScreenHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StarRating } from "../components/StarRating";
import { TagInput } from "../components/TagInput";
import { EpisodePicker } from "../components/ItemDetail/EpisodePicker";

const STATUS_LABEL: Record<WatchlistItem["status"], string> = {
  want_to_watch: "Want to watch",
  currently_watching: "Currently watching",
  watched: "Watched",
};

interface DetailScreenProps {
  item: WatchlistItem;
  existingTags: string[];
  onBack: () => void;
  onUpdate: (patch: Partial<WatchlistItem>) => void;
  onMarkWatched: () => void;
  onMarkWantToWatch: () => void;
  onMarkCurrentlyWatching: () => void;
  onSetCurrentEpisode: (episode: EpisodeRef | null) => void;
  onSetRating: (rating: number | null) => void;
  onDelete: () => void;
  isRecommended: boolean;
  onAddToRecommendations: () => void;
}

// Full page rather than a bottom-sheet modal, per the same reasoning as
// AddScreen — and it's what makes a genuinely centered delete-confirmation
// dialog (ConfirmDialog) possible, since the sheet-style Modal is anchored
// to the bottom edge by design.
export function DetailScreen({
  item,
  existingTags,
  onBack,
  onUpdate,
  onMarkWatched,
  onMarkWantToWatch,
  onMarkCurrentlyWatching,
  onSetCurrentEpisode,
  onSetRating,
  onDelete,
  isRecommended,
  onAddToRecommendations,
}: DetailScreenProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [episodes, setEpisodes] = useState<TvmazeEpisode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Edit-mode draft state, seeded from the item when edit starts.
  const [draftIsRec, setDraftIsRec] = useState(item.isRecommendation);
  const [draftBy, setDraftBy] = useState(item.recommendedBy ?? "");
  const [draftNote, setDraftNote] = useState(item.recommendationNote ?? "");
  const [draftNotes, setDraftNotes] = useState(item.personalNotes ?? "");
  const [draftTags, setDraftTags] = useState<string[]>(item.personalTags);

  const isCurrentlyWatchingTv = item.mediaType === "tv" && item.status === "currently_watching";

  useEffect(() => {
    if (!isCurrentlyWatchingTv) return;
    let cancelled = false;
    setEpisodesLoading(true);
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

  const startEditing = () => {
    setDraftIsRec(item.isRecommendation);
    setDraftBy(item.recommendedBy ?? "");
    setDraftNote(item.recommendationNote ?? "");
    setDraftNotes(item.personalNotes ?? "");
    setDraftTags(item.personalTags);
    setEditing(true);
  };

  const saveEditing = () => {
    onUpdate({
      isRecommendation: draftIsRec,
      recommendedBy: draftIsRec && draftBy.trim() ? draftBy.trim() : null,
      recommendationNote:
        draftIsRec && draftNote.trim() ? draftNote.trim() : null,
      personalNotes: draftNotes.trim() ? draftNotes.trim() : null,
      personalTags: draftTags,
    });
    setEditing(false);
  };

  return (
    <div className="app-screen">
      <ScreenHeader
        title={item.title}
        onBack={onBack}
        right={
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            aria-label="Delete item"
            onClick={() => setConfirmingDelete(true)}
          >
            🗑
          </button>
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
            </div>
          </div>

          {item.status !== "want_to_watch" && (
            <section className="detail-section">
              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={onAddToRecommendations}
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
              <h3 className="detail-section__title">Recommendation</h3>
              {!editing && (
                <button type="button" className="link-btn" onClick={startEditing}>
                  Edit
                </button>
              )}
            </div>

            {!editing && (
              <>
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
              </>
            )}

            {editing && (
              <div className="details-form">
                <fieldset className="details-form__field">
                  <legend>Is this a recommendation?</legend>
                  <div className="segmented">
                    <button
                      type="button"
                      className={`segmented__option ${draftIsRec ? "is-active" : ""}`}
                      onClick={() => setDraftIsRec(true)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`segmented__option ${!draftIsRec ? "is-active" : ""}`}
                      onClick={() => setDraftIsRec(false)}
                    >
                      No
                    </button>
                  </div>
                </fieldset>

                {draftIsRec && (
                  <>
                    <div className="details-form__field">
                      <label htmlFor="edit-recommended-by">Who recommended it?</label>
                      <input
                        id="edit-recommended-by"
                        type="text"
                        dir="auto"
                        value={draftBy}
                        onChange={(e) => setDraftBy(e.target.value)}
                      />
                    </div>
                    <div className="details-form__field">
                      <label htmlFor="edit-recommendation-note">What did they say?</label>
                      <textarea
                        id="edit-recommendation-note"
                        dir="auto"
                        rows={2}
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="details-form__field">
                  <label htmlFor="edit-personal-notes">Notes</label>
                  <textarea
                    id="edit-personal-notes"
                    dir="auto"
                    rows={2}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Anything you want to remember about this"
                  />
                </div>

                <div className="details-form__field">
                  <label>My tags</label>
                  <TagInput
                    tags={draftTags}
                    onChange={setDraftTags}
                    suggestions={existingTags}
                  />
                </div>

                <div className="details-form__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={saveEditing}
                  >
                    Save changes
                  </button>
                </div>
              </div>
            )}
          </section>

          {!editing && item.personalNotes && (
            <section className="detail-section">
              <h3 className="detail-section__title">Notes</h3>
              <p className="item-detail__notes">{item.personalNotes}</p>
            </section>
          )}

          {!editing && (item.personalTags ?? []).length > 0 && (
            <section className="detail-section">
              <h3 className="detail-section__title">My tags</h3>
              <div className="tag-input__chips">
                {item.personalTags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

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
    </div>
  );
}
