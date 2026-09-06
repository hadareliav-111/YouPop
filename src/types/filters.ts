import type { MediaType, TvSubtype, WatchStatus } from "./index";

export type MediaTypeFilter = "all" | MediaType;
export type TvSubtypeFilter = "all" | TvSubtype;
export type StatusFilter = "all" | WatchStatus;
export type RecommendedFilter = "all" | "yes" | "no";
export type SortMode = "manual" | "rating" | "recent" | "year";

export interface Filters {
  mediaType: MediaTypeFilter;
  tvSubtype: TvSubtypeFilter; // only meaningful within the TV Shows category
  status: StatusFilter;
  genre: string | null;
  tag: string | null;
  recommended: RecommendedFilter;
  recommender: string | null;
  sort: SortMode;
}

export const DEFAULT_FILTERS: Filters = {
  mediaType: "all",
  tvSubtype: "all",
  status: "all",
  genre: null,
  tag: null,
  recommended: "all",
  recommender: null,
  sort: "manual",
};

export function countActiveExtraFilters(filters: Filters): number {
  let count = 0;
  if (filters.status !== "all") count++;
  if (filters.genre) count++;
  if (filters.tag) count++;
  if (filters.recommended !== "all") count++;
  if (filters.recommender) count++;
  if (filters.sort !== "manual") count++;
  return count;
}
