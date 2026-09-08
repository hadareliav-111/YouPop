import type { MediaSource } from "../types";
import { useWhereToWatch } from "../hooks/useWhereToWatch";

interface WhereToWatchProps {
  externalSource: MediaSource;
  externalId: string;
}

// Answers exactly one question — "where can I watch this in Israel?" —
// with just a provider name, small logo, and a clickable link. Never
// shows subscription/rent/buy/free or any other API detail; on a fetch
// error it stays silent (same "non-critical enrichment" convention as
// DetailScreen's ratings-enrichment effect) rather than showing an error
// state, since a transient failure isn't the same true answer as "not
// available". Deliberately compact, no border/section divider of its own
// — embedded directly in the hero info column beside the poster (under
// genres/ratings), not as a separate full-width section, so it never
// adds extra height below Overview. Reuses detail-section__title's exact
// text style for the label so it still reads as "one more fact about
// this title," consistent with meta/genres/ratings above it, without
// needing its own CSS rule for that.
export function WhereToWatch({ externalSource, externalId }: WhereToWatchProps) {
  const { providers, loading, error } = useWhereToWatch(externalSource, externalId);

  if (error) return null;

  return (
    <div className="where-to-watch">
      <p className="detail-section__title">Where to Watch</p>

      {loading && <p className="text-muted where-to-watch__status">Checking availability…</p>}

      {!loading && (
        <>
          {providers.length === 0 ? (
            <>
              <p className="text-muted where-to-watch__status">Not currently available in Israel</p>
              <p className="where-to-watch__disney-note">
                Availability results do not currently include Disney+.
              </p>
            </>
          ) : (
            <div className="where-to-watch__providers">
              {providers.map((p) => (
                <a
                  key={p.id}
                  className="where-to-watch__provider"
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.logoUrl && (
                    <img
                      className="where-to-watch__logo"
                      src={p.logoUrl}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span>{p.name}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
