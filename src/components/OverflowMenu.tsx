import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface OverflowMenuItem {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  ariaLabel: string;
  // Lets a caller (e.g. a card that needs the trigger absolutely
  // positioned in one of its corners) add its own class to the root,
  // without every use site needing its own copy of this component.
  className?: string;
}

// Module-level, not component state: holds whichever menu is currently
// open's own close function, so any instance anywhere in the app can
// close a *different* instance's menu without either one knowing the
// other exists. Opening a menu closes whatever this currently points to
// (if anything), then points it at itself; closing (by any path — toggle,
// outside click, Escape, selecting an item, unmounting) clears it, but
// only if it's still pointing at *this* instance — otherwise some other,
// already-open menu would get incorrectly cleared out from under itself.
let activeMenuClose: (() => void) | null = null;

// A small "..." trigger that opens a short list of actions — used wherever
// a screen or card needs one or two secondary actions tucked away rather
// than shown as standalone buttons. Closes on an outside click, Escape,
// selecting an item, or another OverflowMenu opening — never more than one
// open at a time, app-wide. Deliberately generic/stateless about what the
// items *do* — callers own their own confirmation dialogs, navigation, etc.
export function OverflowMenu({ items, ariaLabel, className }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  // Whether the panel hangs from the trigger's left edge instead of its
  // default right edge — flipped only when the default position would
  // overflow the visible phone viewport (see the layout effect below).
  const [openLeft, setOpenLeft] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // useState's lazy initializer runs exactly once, on mount, so `close`
  // keeps the same identity for this instance's whole lifetime — that's
  // what makes the `===` checks against the module-level activeMenuClose
  // meaningful across renders. `fn` refers to itself from inside its own
  // body, which is fine (that reference only ever runs later, once fn is
  // fully defined) — but only works written this way, as a plain local
  // function the initializer returns, not as a hook value referencing
  // itself from inside its own hook call.
  const [close] = useState<() => void>(() => {
    const fn = () => {
      setOpen(false);
      if (activeMenuClose === fn) activeMenuClose = null;
    };
    return fn;
  });

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    activeMenuClose?.();
    activeMenuClose = close;
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Closes this instance's menu, if it's the one currently registered as
  // open, when the component itself unmounts mid-open (e.g. the list it's
  // in re-renders with a different key) — otherwise the stale reference
  // would linger and never get cleared.
  useEffect(() => {
    return () => {
      if (activeMenuClose === close) activeMenuClose = null;
    };
  }, [close]);

  // Measures the panel's actual rendered position against the app's own
  // viewport (the phone frame, .app-shell — not the browser window, which
  // on desktop can be much wider than the frame) right after it mounts in
  // its default (right-edge-aligned) position, and flips it to hang from
  // the trigger's left edge instead if that default would clip past the
  // left side. useLayoutEffect runs before the browser paints, so this
  // never produces a visible flash of the wrong position.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const container = rootRef.current?.closest<HTMLElement>(".app-shell");
    const boundsLeft = container?.getBoundingClientRect().left ?? 0;
    const panelRect = panel.getBoundingClientRect();
    setOpenLeft(panelRect.left < boundsLeft);
  }, [open]);

  return (
    <div className={`overflow-menu${className ? ` ${className}` : ""}`} ref={rootRef}>
      <button
        type="button"
        className="icon-btn overflow-menu__trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`overflow-menu__panel${openLeft ? " overflow-menu__panel--left" : ""}`}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`overflow-menu__item${item.danger ? " overflow-menu__item--danger" : ""}`}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                close();
                item.onSelect?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
