// "Availability" is deliberately kept separate from the user's own status
// (Want to Watch / Currently Watching / Watched) — it's a derived fact
// about the real world ("has this actually come out yet"), not something
// the user sets, and it never becomes a status of its own. It's only
// meaningful for Want to Watch items: once you're Currently Watching or
// have Watched something, whether it "has been released" is moot.

export type ReleaseAvailability = "available" | "upcoming";

// Unknown release date -> treat as available rather than blocking anything;
// we only ever *add* an "upcoming" signal when we're confident about it.
export function getReleaseAvailability(releaseDate: string | null): ReleaseAvailability {
  if (!releaseDate) return "available";
  const release = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(release.getTime())) return "available";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  release.setHours(0, 0, 0, 0);
  return release.getTime() > today.getTime() ? "upcoming" : "available";
}

export function formatReleaseDate(releaseDate: string): string {
  const date = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return releaseDate;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "Coming Dec 18, 2026" for cards/detail, where there's room.
export function formatComingLabel(releaseDate: string): string {
  return `Coming ${formatReleaseDate(releaseDate)}`;
}

// "Dec 18" for tight rail-tile badges — same idea, no year (this app is
// personal/short-horizon enough that the year rarely adds value there).
export function formatShortComingLabel(releaseDate: string): string {
  const date = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Coming soon";
  return `Coming ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
