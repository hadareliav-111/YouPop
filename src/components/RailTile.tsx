import type { PosterEntry } from "../types";

interface RailTileProps {
  item: PosterEntry;
  badge?: string;
  onClick: () => void;
}

export function RailTile({ item, badge, onClick }: RailTileProps) {
  return (
    <button type="button" className="rail-tile" onClick={onClick}>
      {item.posterUrl ? (
        <img
          className="rail-tile__poster"
          src={item.posterUrl}
          alt=""
          loading="lazy"
          decoding="async"
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
