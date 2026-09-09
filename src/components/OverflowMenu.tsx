import { useEffect, useRef, useState } from "react";

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

// A small "..." trigger that opens a short list of actions — used wherever
// a screen or card needs one or two secondary actions tucked away rather
// than shown as standalone buttons. Closes on an outside click, Escape, or
// selecting an item. Deliberately generic/stateless about what the items
// *do* — callers own their own confirmation dialogs, navigation, etc.
export function OverflowMenu({ items, ariaLabel, className }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
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
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div className="overflow-menu__panel" role="menu">
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
                setOpen(false);
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
