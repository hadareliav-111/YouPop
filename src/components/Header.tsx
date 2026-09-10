interface HeaderProps {
  title: string;
  onAdd?: () => void;
  onOpenWatched?: () => void;
  onOpenMenu: () => void;
}

// Shared by all three root tab screens (Watchlist, Recommendations, and
// Friends) so they get identical title position, typography, and header
// height for free — each just passes the title and whichever action icons
// actually apply to it. Watched is a Watchlist-only concept and stays
// optional for that reason; Menu is always present since it's the same
// Settings modal from every tab. Friends is no longer a Header action — it's
// its own main tab now, with Friends management reached one level deeper via
// that tab's "Manage Friends" button.
export function Header({
  title,
  onAdd,
  onOpenWatched,
  onOpenMenu,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__row">
        <h1 className="app-header__title">{title}</h1>
        <div className="app-header__actions">
          {onAdd && (
            <button
              type="button"
              className="btn btn--add btn--compact"
              onClick={onAdd}
            >
              + Add
            </button>
          )}
          {onOpenWatched && (
            <button
              type="button"
              className="btn btn--outline btn--compact"
              onClick={onOpenWatched}
            >
              Watched
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label="Menu"
            onClick={onOpenMenu}
          >
            ⋯
          </button>
        </div>
      </div>
    </header>
  );
}
