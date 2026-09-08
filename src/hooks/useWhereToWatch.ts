import { useEffect, useState } from "react";
import type { MediaSource } from "../types";
import { fetchWhereToWatch, type WhereToWatchProvider } from "../lib/whereToWatchApi";

// Loads Israel streaming availability for one title — cache-hit-first via
// fetchWhereToWatch, so opening a detail screen for something already
// looked up never touches motn-proxy or Movie of the Night again.
export function useWhereToWatch(externalSource: MediaSource, externalId: string) {
  const [providers, setProviders] = useState<WhereToWatchProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchWhereToWatch(externalSource, externalId)
      .then((result) => {
        if (!cancelled) setProviders(result);
      })
      .catch((err) => {
        console.error("Failed to load Where to Watch", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [externalSource, externalId]);

  return { providers, loading, error };
}
