import type { TvmazeEpisode } from "./providers";
import type { EpisodeRef } from "../types";
import { daysUntil } from "./countdown";

// Finds the episode immediately after the user's last-watched one. Null
// `current` means "not started yet" -> the very first episode. Assumes
// `episodes` is already in air order (TVmaze returns it that way).
export function findNextEpisode(
  episodes: TvmazeEpisode[],
  current: EpisodeRef | null,
): TvmazeEpisode | null {
  if (episodes.length === 0) return null;
  if (!current) return episodes[0];

  const index = episodes.findIndex(
    (e) => e.season === current.season && e.number === current.number,
  );
  if (index === -1) return episodes[0];
  return episodes[index + 1] ?? null;
}

export type EpisodeAvailability = "available" | "upcoming" | "none";

export interface NextEpisodeStatus {
  episode: TvmazeEpisode | null;
  availability: EpisodeAvailability;
  label: string;
  // Long-form exact air date ("September 13, 2026") — set only alongside
  // an "upcoming" label, for DetailScreen to show next to the relative
  // timing. Deliberately a separate field rather than folded into `label`
  // itself: HomeScreen's rail-tile badges also read `label` directly, and
  // have no room for a full date in that tight, single-line pill.
  exactDate: string | null;
  // Sort key: available-now and past dates sort first (most negative/zero),
  // upcoming dates next (ascending — soonest first), "none" always last.
  sortKey: number;
}

function formatExactAirDate(airdate: string): string {
  const date = new Date(`${airdate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return airdate;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function getNextEpisodeStatus(
  episodes: TvmazeEpisode[],
  current: EpisodeRef | null,
): NextEpisodeStatus {
  const episode = findNextEpisode(episodes, current);

  if (!episode || !episode.airdate) {
    return { episode, availability: "none", label: "No upcoming episode", exactDate: null, sortKey: Infinity };
  }

  const days = daysUntil(episode.airdate);
  if (days <= 0) {
    return { episode, availability: "available", label: "Available now", exactDate: null, sortKey: days };
  }
  const label = days === 1 ? "Tomorrow" : `In ${days} days`;
  return {
    episode,
    availability: "upcoming",
    label,
    exactDate: formatExactAirDate(episode.airdate),
    sortKey: days,
  };
}

export function episodeLabel(episode: EpisodeRef | null): string {
  if (!episode) return "Not started";
  return `S${episode.season} E${episode.number}`;
}
