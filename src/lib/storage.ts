import type { ExportedData, WatchlistItem } from "../types";
import { EXPORT_SCHEMA_VERSION } from "../types";

// Note: this module no longer reads or writes the old `watchlist:items`
// localStorage key — Supabase (via src/lib/watchlistApi.ts) is the sole
// source of truth for a logged-in user's watchlist. Nothing here deletes
// that key or any data in it; the app just no longer has a code path that
// reads it. `normalizeItem`/`normalizeSortOrders` below are still the
// shared defaulting/ordering logic used both by file import and by
// watchlistApi when reading rows back from Supabase.

export function exportData(items: WatchlistItem[]): void {
  const payload: ExportedData = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `watchlist-export-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedImport {
  items: WatchlistItem[];
}

const REQUIRED_FIELDS: (keyof WatchlistItem)[] = [
  "id",
  "externalId",
  "title",
  "mediaType",
  "status",
];

export function parseImportFile(raw: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  let items: unknown;
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as ExportedData).items)
  ) {
    items = (data as ExportedData).items;
  } else if (Array.isArray(data)) {
    items = data;
  } else {
    throw new Error("This doesn't look like a watchlist export file.");
  }

  if (!Array.isArray(items)) {
    throw new Error("This doesn't look like a watchlist export file.");
  }

  const validated: WatchlistItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Partial<WatchlistItem>;
    const hasAllRequired = REQUIRED_FIELDS.every(
      (field) => candidate[field] !== undefined && candidate[field] !== null,
    );
    if (!hasAllRequired) continue;
    validated.push(normalizeItem(candidate));
  }

  if (validated.length === 0) {
    throw new Error("No valid watchlist items were found in this file.");
  }

  return { items: normalizeSortOrders(validated, (item) => item.mediaType) };
}

const VALID_STATUSES: WatchlistItem["status"][] = [
  "want_to_watch",
  "currently_watching",
  "watched",
];

const VALID_TV_SUBTYPES: WatchlistItem["tvSubtype"][] = ["scripted", "reality"];

function isValidEpisodeRef(value: unknown): value is WatchlistItem["currentEpisode"] {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { season?: unknown }).season === "number" &&
    typeof (value as { number?: unknown }).number === "number"
  );
}

// Fills in a safe default for every field, so older saved/imported data
// (missing fields the schema didn't have yet) never crashes rendering code
// that assumes the full shape is present. Also migrates the old
// mediaType: "reality" (a former top-level category) to the current model,
// where reality is a tv subtype. Used for both localStorage loads and file
// imports.
export function normalizeItem(candidate: Partial<WatchlistItem>): WatchlistItem {
  const legacyMediaType = candidate.mediaType as string | undefined;
  const mediaType: WatchlistItem["mediaType"] =
    legacyMediaType === "reality" ? "tv" : (legacyMediaType as WatchlistItem["mediaType"]) ?? "movie";

  let tvSubtype: WatchlistItem["tvSubtype"] = null;
  if (mediaType === "tv") {
    if (legacyMediaType === "reality") {
      tvSubtype = "reality";
    } else if (VALID_TV_SUBTYPES.includes(candidate.tvSubtype as WatchlistItem["tvSubtype"])) {
      tvSubtype = candidate.tvSubtype as WatchlistItem["tvSubtype"];
    } else {
      tvSubtype = "scripted";
    }
  }

  return {
    id: String(candidate.id ?? crypto.randomUUID()),
    externalId: String(candidate.externalId ?? ""),
    externalSource:
      (candidate.externalSource as WatchlistItem["externalSource"]) ??
      "tvmaze",
    title: String(candidate.title ?? "Untitled"),
    mediaType,
    tvSubtype,
    releaseYear: candidate.releaseYear ?? null,
    releaseDate: typeof candidate.releaseDate === "string" ? candidate.releaseDate : null,
    posterUrl: candidate.posterUrl ?? null,
    genres: Array.isArray(candidate.genres) ? candidate.genres : [],
    overview: candidate.overview ?? "",
    externalRating: candidate.externalRating ?? null,
    externalRatings: Array.isArray(candidate.externalRatings)
      ? candidate.externalRatings
      : [],
    numberOfSeasons: candidate.numberOfSeasons ?? null,
    status: VALID_STATUSES.includes(candidate.status as WatchlistItem["status"])
      ? (candidate.status as WatchlistItem["status"])
      : "want_to_watch",
    personalRating: candidate.personalRating ?? null,
    currentEpisode: isValidEpisodeRef(candidate.currentEpisode) ? candidate.currentEpisode : null,
    isRecommendation: Boolean(candidate.isRecommendation),
    recommendedBy: candidate.recommendedBy ?? null,
    recommendationNote: candidate.recommendationNote ?? null,
    personalNotes: candidate.personalNotes ?? null,
    personalTags: Array.isArray(candidate.personalTags)
      ? candidate.personalTags
      : [],
    // Sentinel for "no valid manual order yet" — normalizeSortOrders (always
    // run right after this) resolves it to a real 0..N-1 position, placing
    // unordered items after any that already have one, in their existing
    // relative order.
    sortOrder:
      typeof candidate.sortOrder === "number" && Number.isFinite(candidate.sortOrder)
        ? candidate.sortOrder
        : Number.MAX_SAFE_INTEGER,
    dateAdded: candidate.dateAdded ?? new Date().toISOString(),
    dateWatched: candidate.dateWatched ?? null,
  };
}

// Re-sequences `sortOrder` to a clean 0..N-1 run within each group (as
// defined by `groupKey`), preserving relative order (existing sortOrder if
// present, otherwise current array position). Groups never interact, so
// e.g. reordering movies can never renumber — or be affected by — tv shows.
// Generic over anything with `id`/`sortOrder` so both WatchlistItem
// (grouped by mediaType) and Recommendation (one flat group, the default)
// share this exact logic instead of two parallel implementations — this is
// also what makes the fetch path tolerant of gaps/duplicate sortOrder
// values already in the DB, not just a cosmetic renumbering.
export function normalizeSortOrders<T extends { id: string; sortOrder: number }>(
  items: T[],
  groupKey: (item: T) => string = () => "*",
): T[] {
  const byGroup = new Map<string, T[]>();
  items.forEach((item, index) => {
    const key = groupKey(item);
    const list = byGroup.get(key) ?? [];
    list.push({ ...item, sortOrder: item.sortOrder * 1e9 + index }); // stabilize ties by original position
    byGroup.set(key, list);
  });

  const resolvedOrder = new Map<string, number>();
  for (const group of byGroup.values()) {
    group
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((item, index) => resolvedOrder.set(item.id, index));
  }

  return items.map((item) => ({
    ...item,
    sortOrder: resolvedOrder.get(item.id) ?? 0,
  }));
}

export function mergeItems(
  existing: WatchlistItem[],
  incoming: WatchlistItem[],
): WatchlistItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  // Also dedupe by externalId+mediaType so re-importing doesn't duplicate
  // items that were re-added with a fresh internal id.
  const byExternal = new Map(
    existing.map((item) => [`${item.externalSource}:${item.externalId}`, item]),
  );

  for (const item of incoming) {
    const externalKey = `${item.externalSource}:${item.externalId}`;
    if (byId.has(item.id) || byExternal.has(externalKey)) continue;
    byId.set(item.id, item);
    byExternal.set(externalKey, item);
  }

  return normalizeSortOrders(Array.from(byId.values()), (item) => item.mediaType);
}
