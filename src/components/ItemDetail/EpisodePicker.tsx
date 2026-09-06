import { useMemo, useState } from "react";
import type { TvmazeEpisode } from "../../lib/providers";
import type { EpisodeRef } from "../../types";

interface EpisodePickerProps {
  episodes: TvmazeEpisode[];
  current: EpisodeRef | null;
  onSelect: (episode: EpisodeRef) => void;
  onCancel: () => void;
}

export function EpisodePicker({ episodes, current, onSelect, onCancel }: EpisodePickerProps) {
  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b),
    [episodes],
  );
  const [season, setSeason] = useState(current?.season ?? seasons[seasons.length - 1] ?? 1);

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
          return (
            <li key={ep.id}>
              <button
                type="button"
                className={`episode-picker__row ${isCurrent ? "is-current" : ""}`}
                onClick={() => onSelect({ season: ep.season, number: ep.number })}
              >
                <span className="episode-picker__row-number">E{ep.number}</span>
                <span className="episode-picker__row-name">{ep.name || "Untitled"}</span>
                {isCurrent && <span className="episode-picker__row-badge">Current</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="btn btn--ghost btn--block" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
