import type { PosterEntry } from "../types";

interface RailTileProps {
  item: PosterEntry;
  badge?: string;
  onClick: () => void;
  // Set true only by screens that can be a swipe-back destination/backdrop
  // (see App.tsx's renderSwipeBackdrop). Their posters get destroyed and
  // recreated fresh on every navigation handoff, and a brand-new
  // <img loading="lazy" decoding="async"> isn't guaranteed to paint its
  // (already browser-cached) bitmap in the same frame it's inserted — that
  // gap was the post-swipe image flicker. Default (false/omitted) leaves
  // every other usage exactly as before.
  eager?: boolean;
}

export function RailTile({ item, badge, onClick, eager }: RailTileProps) {
  return (
    <button type="button" className="rail-tile" onClick={onClick}>
      {item.posterUrl ? (
        <img
          className="rail-tile__poster"
          src={item.posterUrl}
          alt=""
          loading={eager ? undefined : "lazy"}
          decoding={eager ? undefined : "async"}
        />
      ) : (
        <div className="rail-tile__poster rail-tile__poster--placeholder">🎬</div>
      )}
      {badge && <span className="rail-tile__badge">{badge}</span>}
      <div className="rail-tile__scrim">
        <p className="rail-tile__title">{item.title}</p>
      </div>
    </button>
  );
}
