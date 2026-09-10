import { useEffect, useState } from "react";
import type { EpisodeRef, WatchlistItem } from "../types";
import { getCachedEpisodes, getEpisodes, type TvmazeEpisode } from "../lib/providers";
import { getNextEpisodeStatus, episodeLabel } from "../lib/episodeProgress";
import { ScreenHeader } from "../components/ScreenHeader";
import { EpisodePicker } from "../components/ItemDetail/EpisodePicker";
import { useSwipeBack } from "../hooks/useSwipeBack";

interface EpisodeProgressScreenProps {
  item: WatchlistItem;
  onBack: () => void;
  onSetCurrentEpisode: (episode: EpisodeRef | null) => void;
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

// Split out of DetailScreen so a Currently Watching show's own detail page
// stays a single, compact screen — this is reached only via that page's
// "Episode Progress" row, and only for a currently-watching TV item, so it
// doesn't re-check either condition itself. "I've watched up to..." reveals
// the season/episode picker inline, below the always-visible progress
// summary — purely a local display toggle (pickerOpen), never a separate
// navigation state: Back/Swipe Back always leave this one screen for
// Detail directly, whether or not the picker happens to be open.
export function EpisodeProgressScreen({
  item,
  onBack,
  onSetCurrentEpisode,
  onSwipeActiveChange,
}: EpisodeProgressScreenProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Edge-swipe-to-go-back — see useSwipeBack's own comment for why it
  // can't collide with normal scrolling here.
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  // Seeded synchronously from the shared episodes cache (see
  // useNextEpisodes.ts's own comment on getCachedEpisodes for the full
  // rationale) — this screen fully unmounts/remounts on every push/pop,
  // and without this, it would always start from "Loading episodes…" for a
  // frame even though this exact item's episodes were already fetched
  // moments ago by DetailScreen or a previous mount of this same screen.
  const [episodes, setEpisodes] = useState<TvmazeEpisode[]>(
    () => getCachedEpisodes(item.externalSource, item.externalId) ?? [],
  );
  const [episodesLoading, setEpisodesLoading] = useState(
    () => !getCachedEpisodes(item.externalSource, item.externalId),
  );

  useEffect(() => {
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
  }, [item.externalSource, item.externalId]);

  const nextEpisodeStatus = getNextEpisodeStatus(episodes, item.currentEpisode);
  // Before any progress is set, "I've watched up to..." is the one action
  // that actually matters (setting a starting point) — "Mark ... as
  // watched" only ever advances one episode at a time, which isn't the
  // useful move for a show you haven't started. Once real progress
  // exists, that flips: advancing one episode is the common case, and
  // jumping around manually becomes the secondary action.
  const hasStarted = item.currentEpisode !== null;

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader title="Episode Progress" onBack={onBack} />

      {/* Not .app-screen__scroll: with the picker open, its own episode
          list (not this wrapper) is what needs to grow to fill/scroll the
          remaining space, while the summary above it stays put — see
          .episode-progress-screen__body's own comment in index.css. */}
      <div className="episode-progress-screen__body">
        <div className="episode-progress">
          <p className="episode-progress__current">
            Last watched: <strong>{episodeLabel(item.currentEpisode)}</strong>
          </p>
          {episodesLoading && <p className="text-muted">Loading episodes…</p>}
          {!episodesLoading && (
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
              {hasStarted ? (
                <>
                  {!pickerOpen && nextEpisodeStatus.episode && nextEpisodeStatus.availability === "available" && (
                    <button
                      type="button"
                      className="btn btn--primary btn--compact"
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
                    className="btn btn--secondary btn--compact"
                    onClick={() => setPickerOpen(true)}
                    disabled={pickerOpen}
                  >
                    I've watched up to...
                  </button>
                </>
              ) : (
                // No current episode yet — "I've watched up to..." is the
                // only action. A "Mark ... as watched" quick action only
                // makes sense once there's real progress to advance from.
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={() => setPickerOpen(true)}
                  disabled={pickerOpen}
                >
                  I've watched up to...
                </button>
              )}
            </>
          )}
        </div>

        {pickerOpen && (
          <EpisodePicker
            episodes={episodes}
            current={item.currentEpisode}
            // Selecting saves immediately and keeps the picker open — you
            // can see/change the selection without leaving this screen.
            // Back/Swipe Back always leave straight to Detail regardless
            // of whether the picker is open (see this screen's own
            // top-of-file comment); there's no separate "close the picker"
            // step or Cancel button.
            onSelect={(ep) => onSetCurrentEpisode(ep)}
          />
        )}
      </div>
    </div>
  );
}
