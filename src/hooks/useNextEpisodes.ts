import { useEffect, useState } from "react";
import type { WatchlistItem } from "../types";
import { getEpisodes } from "../lib/providers";
import { getNextEpisodeStatus, type NextEpisodeStatus } from "../lib/episodeProgress";

// Resolves "what's coming up" status for currently-watching items, relative
// to each item's own watched progress (currentEpisode) — not just whatever
// the show's next episode overall happens to be. Only TVmaze-sourced shows
// have episode data; everything else silently resolves to nothing.
export function useNextEpisodes(
  items: WatchlistItem[],
): Record<string, NextEpisodeStatus> {
  const [statuses, setStatuses] = useState<Record<string, NextEpisodeStatus>>({});

  const targets = items.filter((i) => i.status === "currently_watching");
  const relevantKey = targets
    .map((i) => `${i.id}:${i.currentEpisode?.season ?? 0}:${i.currentEpisode?.number ?? 0}`)
    .join(",");

  useEffect(() => {
    let cancelled = false;

    targets.forEach((item) => {
      getEpisodes(item.externalSource, item.externalId).then((episodes) => {
        if (cancelled) return;
        const status = getNextEpisodeStatus(episodes, item.currentEpisode);
        setStatuses((prev) => ({ ...prev, [item.id]: status }));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [relevantKey]);

  return statuses;
}
