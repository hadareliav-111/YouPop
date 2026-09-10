import { useMemo, useState } from "react";
import type { TvmazeEpisode } from "../../lib/providers";
import type { EpisodeRef } from "../../types";
import { daysUntil } from "../../lib/countdown";
import { formatReleaseDate } from "../../lib/availability";

interface EpisodePickerProps {
  episodes: TvmazeEpisode[];
  current: EpisodeRef | null;
  onSelect: (episode: EpisodeRef) => void;
}

export function EpisodePicker({ episodes, current, onSelect }: EpisodePickerProps) {
  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b),
    [episodes],
  );
  // Defaults to the *first* season (so the first thing a not-yet-started
  // show shows is S1E1) rather than the last one, unless the item already
  // has a saved current episode, in which case that season still wins.
  const [season, setSeason] = useState(current?.season ?? seasons[0] ?? 1);

  const episodesInSeason = episodes.filter((e) => e.season === season);

  return (
    <div className="episode-picker">
      <p className="episode-picker__hint">
        Select the last episode you've watched.
      </p>

      <div className="details-form__field">
        <label htmlFor="episode-picker-season">Season</label>
        <select
          id="episode-picker-season"
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              Season {s}
            </option>
          ))}
        </select>
      </div>

      <ul className="episode-picker__list">
        {episodesInSeason.map((ep) => {
          const isCurrent = current?.season === ep.season && current?.number === ep.number;
          // Same "has it actually aired yet" check as the Currently
          // Watching progress card (see episodeProgress.ts's own
          // availability logic) — an episode with no airdate at all is
          // treated the same as a future one, since there's no date to
          // confirm it's actually out yet.
          const hasAired = Boolean(ep.airdate) && daysUntil(ep.airdate) <= 0;
          // Every row shows its air date now, aired or not — only whether
          // it's clickable (hasAired, above) still depends on that date.
          const dateLabel = ep.airdate ? formatReleaseDate(ep.airdate) : "TBA";
          return (
            <li key={ep.id}>
              <button
                type="button"
                className={`episode-picker__row ${isCurrent ? "is-current" : ""}`}
                disabled={!hasAired}
                onClick={() => onSelect({ season: ep.season, number: ep.number })}
              >
                <span className="episode-picker__row-number">E{ep.number}</span>
                <span className="episode-picker__row-name">{ep.name || "Untitled"}</span>
                <span className="episode-picker__row-badge">
                  {isCurrent ? `Current · ${dateLabel}` : dateLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
