// Reality is a tv subtype, not its own mediaType — this is the one place
// that turns (mediaType, tvSubtype) into the label a user sees.
export function mediaTypeLabel(
  mediaType: "movie" | "tv",
  tvSubtype: "scripted" | "reality" | null,
): string {
  if (mediaType === "movie") return "Movie";
  return tvSubtype === "reality" ? "Reality" : "TV Show";
}
