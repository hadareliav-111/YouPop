// Calendar-day difference (not exact hours) since that's how people
// actually think about "when's the next episode" — e.g. "Tomorrow" rather
// than "in 14 hours". Negative/zero means it's already available.
export function daysUntil(airDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const air = new Date(`${airDate}T00:00:00`);
  air.setHours(0, 0, 0, 0);

  return Math.round((air.getTime() - today.getTime()) / 86_400_000);
}

export function formatDaysUntil(airDate: string): string {
  const days = daysUntil(airDate);
  if (days <= 0) return "Available now";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}
