import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { isOmdbConfigured } from "../lib/providers";
import { fetchOmdbUsage, type OmdbUsage } from "../lib/apiUsage";

interface MenuModalProps {
  onClose: () => void;
  displayName: string | null;
  onSignOut: () => void;
  // Whether the signed-in user is allowed to see the OMDb API Usage
  // section below — gated by App.tsx on a fixed Supabase user id (never
  // username, never rendered here or anywhere), since it's a shared,
  // app-wide quota only meaningful to the app's own owner.
  canViewOmdbUsage: boolean;
}

export function MenuModal({ onClose, displayName, onSignOut, canViewOmdbUsage }: MenuModalProps) {
  const [usage, setUsage] = useState<OmdbUsage | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);

  useEffect(() => {
    if (!canViewOmdbUsage || !isOmdbConfigured()) return;
    let cancelled = false;
    fetchOmdbUsage()
      .then((u) => {
        if (!cancelled) setUsage(u);
      })
      .catch((err) => {
        console.error("Failed to load OMDb usage", err);
        if (!cancelled) setUsageFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewOmdbUsage]);

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="menu-modal">
        <section className="detail-section">
          <h3 className="detail-section__title">Account</h3>
          {displayName && <p className="text-muted">{displayName}</p>}
          <button type="button" className="btn btn--danger" onClick={onSignOut}>
            Log out
          </button>
        </section>

        {canViewOmdbUsage && (
        <section className="detail-section">
          <h3 className="detail-section__title">App-wide OMDb requests today</h3>
          {!isOmdbConfigured() ? (
            <p className="text-muted">
              OMDb proxy not enabled in this environment — movie search is
              currently using placeholder preview data, so no OMDb requests
              are being made.
            </p>
          ) : usageFailed ? (
            <p className="text-muted">Couldn't load usage right now.</p>
          ) : usage ? (
            <>
              <p className="menu-modal__usage-stat">
                Used: <strong>{usage.used.toLocaleString()}</strong> /{" "}
                {usage.limit.toLocaleString()}
              </p>
              <p className="menu-modal__usage-stat">
                Remaining: <strong>{usage.remaining.toLocaleString()}</strong>
              </p>
              <p className="menu-modal__usage-stat">
                Resets at:{" "}
                <strong>
                  {usage.resetsAt.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </p>
              <p className="text-muted">
                Shared across every user of this app — there's one OMDb key
                and one daily limit for everyone. OMDb doesn't expose its
                own account usage anywhere, so this counts real requests
                made through the app's central proxy today.
              </p>
            </>
          ) : (
            <p className="text-muted">Loading…</p>
          )}
        </section>
        )}

        <section className="detail-section">
          <h3 className="detail-section__title">About</h3>
          <p className="text-muted attribution">
            TV and reality show data from{" "}
            <a href="https://www.tvmaze.com/" target="_blank" rel="noreferrer">
              TVmaze
            </a>
            . Movie data from{" "}
            <a href="https://www.omdbapi.com/" target="_blank" rel="noreferrer">
              OMDb
            </a>
            .
          </p>
          <p className="text-muted attribution">
            Streaming availability information is provided by{" "}
            <a
              href="https://www.movieofthenight.com/about/api"
              target="_blank"
              rel="noreferrer"
            >
              Streaming Availability API by Movie of the Night
            </a>
            .
          </p>
        </section>
      </div>
    </Modal>
  );
}
