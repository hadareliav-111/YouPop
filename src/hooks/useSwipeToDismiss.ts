import { useEffect, useRef } from "react";

// Native "drag the sheet down to dismiss" gesture for Modal's bottom
// sheet, mirroring useSwipeBack's own touch-handling approach (manual
// addEventListener with { passive: false } — see that hook's own top
// comment for why a JSX onTouchMove prop's preventDefault() would
// otherwise be a silent no-op, since React registers touchmove as
// passive unconditionally) but adapted for a single vertical drag that
// closes the sheet instead of a horizontal edge-swipe that navigates
// back.
//
// Only starts tracking when the touch begins on the sheet's own drag
// handle or header (matched by class, not a second ref) — .modal__body
// below them can carry arbitrarily long, independently scrollable
// content, and starting the drag there too would fight that scroll
// instead of complementing it. Real iPhone sheets support both; this
// covers the one that can't collide with anything else here.
const COMMIT_RATIO = 0.35; // fraction of the sheet's own height that counts as "far enough"
const COMMIT_VELOCITY_PX_MS = 0.5; // a fast flick commits even short of that distance
const ANIMATION_MS = 220;

export function useSwipeToDismiss(onDismiss: () => void) {
  const elRef = useRef<HTMLDivElement | null>(null);

  // Latest callback, read from inside the effect below without being a
  // dependency of it — same rationale as useSwipeBack's own onBackRef.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const startY = { current: null as number | null };
    const startX = { current: null as number | null };
    const startTime = { current: 0 };
    const trackHeight = { current: 0 };
    const tracking = { current: false };
    const finishTimer = { current: null as ReturnType<typeof setTimeout> | null };
    const transitionEndCleanup = { current: null as (() => void) | null };

    const setPosition = (px: number, animate: boolean) => {
      el.style.transition = animate ? `transform ${ANIMATION_MS}ms ease` : "none";
      el.style.transform = px > 0 ? `translateY(${px}px)` : "";
    };

    // The single "this didn't result in dismissing" path — stops
    // tracking and always animates the sheet cleanly back to rest,
    // however far it had already moved. Used for a below-threshold
    // release, movement turning out horizontal, and a native
    // touchcancel alike.
    const cancelGesture = () => {
      tracking.current = false;
      startY.current = null;
      startX.current = null;
      setPosition(0, true);
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;
      if (!touch || !target?.closest(".modal__handle, .modal__header")) {
        tracking.current = false;
        return;
      }
      trackHeight.current = el.getBoundingClientRect().height || window.innerHeight;
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      startTime.current = Date.now();
      tracking.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null || startX.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - startY.current;
      const deltaX = touch.clientX - startX.current;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal intent dominates — cancel cleanly rather than just
        // dropping tracking, so any vertical distance already covered
        // gets animated back to rest instead of freezing there.
        cancelGesture();
        return;
      }
      // Only a downward drag dismisses — an upward flick just clamps to 0
      // instead of pulling the sheet up past its resting position.
      e.preventDefault();
      const clamped = Math.max(0, Math.min(deltaY, trackHeight.current));
      setPosition(clamped, false);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null) return;
      const originY = startY.current;
      const elapsedMs = Math.max(1, Date.now() - startTime.current);
      const touch = e.changedTouches[0];
      const deltaY = touch
        ? Math.max(0, Math.min(touch.clientY - originY, trackHeight.current))
        : 0;
      const velocity = deltaY / elapsedMs;

      const shouldCommit =
        trackHeight.current > 0 &&
        (deltaY > trackHeight.current * COMMIT_RATIO || velocity > COMMIT_VELOCITY_PX_MS);

      if (shouldCommit) {
        tracking.current = false;
        startY.current = null;
        startX.current = null;
        setPosition(trackHeight.current, true);

        // Waits for the real transitionend of the slide-away, same as
        // useSwipeBack's own commit path, with a setTimeout fallback for
        // whatever can keep transitionend from firing (an interrupted
        // transition, reduced motion collapsing it, etc.).
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          transitionEndCleanup.current = null;
          if (finishTimer.current) {
            clearTimeout(finishTimer.current);
            finishTimer.current = null;
          }
          onDismissRef.current();
        };
        const handleTransitionEnd = (ev: Event) => {
          const te = ev as TransitionEvent;
          if (te.target !== el || te.propertyName !== "transform") return;
          finish();
        };
        transitionEndCleanup.current?.();
        el.addEventListener("transitionend", handleTransitionEnd);
        transitionEndCleanup.current = () => el.removeEventListener("transitionend", handleTransitionEnd);
        if (finishTimer.current) clearTimeout(finishTimer.current);
        finishTimer.current = setTimeout(finish, ANIMATION_MS + 50);
      } else {
        cancelGesture();
      }
    };

    const onTouchCancel = () => {
      if (!tracking.current) return;
      cancelGesture();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      if (finishTimer.current) clearTimeout(finishTimer.current);
      transitionEndCleanup.current?.();
    };
  }, []);

  return { ref: elRef };
}
