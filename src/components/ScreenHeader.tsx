import type { ReactNode } from "react";

interface ScreenHeaderProps {
  title: string;
  // Omitted for a tab root (e.g. Recommendations) — there's nothing to go
  // back to, since switching tabs is done via the TabBar, not Back. A
  // spacer keeps the title centered either way.
  onBack?: () => void;
  // A right-side action (e.g. Delete on the detail screen) replaces the
  // plain spacer used to keep the title visually centered against the back
  // button — either way the title stays centered between two equal-width
  // slots.
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button type="button" className="icon-btn back-btn" aria-label="Back" onClick={onBack}>
          ‹
        </button>
      ) : (
        <span className="screen-header__spacer" aria-hidden="true" />
      )}
      <h1 className="screen-header__title">{title}</h1>
      {right ? (
        <div className="screen-header__right">{right}</div>
      ) : (
        <span className="screen-header__spacer" aria-hidden="true" />
      )}
    </header>
  );
}
