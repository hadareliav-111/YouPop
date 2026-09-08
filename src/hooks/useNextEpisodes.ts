import { useEffect, useState } from "react";
import type { WatchlistItem } from "../types";
import { getEpisodes, getCachedEpisodes } from "../lib/providers";
import { getNextEpisodeStatus, type NextEpisodeStatus } from "../lib/episodeProgress";

// Resolves "what's coming up" status for currently-watching items, relative
// to each item's own watched progress (currentEpisode) — not just whatever
// the show's next episode overall happens to be. Only TVmaze-sourced shows
// have episode data; everything else silently resolves to nothing.
export function useNextEpisodes(
  items: WatchlistItem[],
): Record<string, NextEpisodeStatus> {
  const targets = items.filter((i) => i.status === "currently_watching");

  // Seeded synchronously, once, from whatever's already in the shared
  // episodes cache (see getCachedEpisodes) — e.g. a previous mount of this
  // same screen (a swipe-back backdrop, or simply having been on this
  // screen a moment ago) already resolved these. Without this, a fresh
  // mount always starts every item at sortKey Infinity (see HomeScreen's
  // sort) until this hook's own effect below re-fetches and re-resolves
  // them, which briefly renders the wrong (unsorted) order on first paint
  // even though the correct data was sitting right there in cache. This
  // only ever seeds the *initial* render (a useState initializer runs
  // once, on mount) — every later update still goes through the effect's
  // setStatuses exactly as before.
  const [statuses, setStatuses] = useState<Record<string, NextEpisodeStatus>>(() => {
    const initial: Record<string, NextEpisodeStatus> = {};
    for (const item of targets) {
      const cached = getCachedEpisodes(item.externalSource, item.externalId);
      if (cached) initial[item.id] = getNextEpisodeStatus(cached, item.currentEpisode);
    }
    return initial;
  });

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
