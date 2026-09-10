import { useEffect, type ReactNode } from "react";
import { useSwipeToDismiss } from "../hooks/useSwipeToDismiss";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  // Drag-down-to-dismiss from the handle/header, like a native iPhone
  // sheet — see useSwipeToDismiss's own comment for why it's scoped to
  // that chrome rather than the whole sheet.
  const swipeToDismiss = useSwipeToDismiss(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${wide ? "modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        {...swipeToDismiss}
      >
        <div className="modal__handle" aria-hidden="true">
          <div className="modal__handle-bar" />
        </div>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
