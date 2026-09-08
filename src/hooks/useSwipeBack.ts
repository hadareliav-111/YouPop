import { useEffect, useRef } from "react";

// Interactive edge-swipe-to-go-back, echoing the native iPhone gesture —
// deliberately narrow in scope, same activation rule as before: a touch
// only starts being tracked if it begins within EDGE_ZONE_PX of the left
// edge, so this can never compete with a tap, a horizontal rail's own
// drag, or a drag-to-reorder grab, none of which ever start a touch that
// close to the edge in practice. A touch starting inside an open modal
// (Modal/ConfirmDialog, both already marked aria-modal="true") is never
// tracked at all, so swipe-back can't fire from underneath an open
// overlay — those keep working exactly as before, untouched.
//
// The screen itself follows the finger in real time (a direct DOM
// transform via the returned ref, not React state — state-per-pixel
// would mean a re-render on every touchmove, which is both unnecessary
// and the wrong tool for a value nothing else in the component needs to
// know about mid-drag) and animates to either fully off (then calls
// onBack — the exact same handler the Back button already uses, never a
// second navigation path) or cleanly back to rest — the same "back to
// rest" path handles every case where the gesture does NOT result in
// going back: released short of the commit threshold, movement turning
// out to be more vertical than horizontal, or the native touch sequence
// itself being cancelled (touchcancel) — so the screen can never be left
// stuck part-way translated. The X axis is the only thing ever written
// to transform; vertical movement is only ever compared against, never
// applied.
//
// onActiveChange (optional) reports exactly when a gesture is being
// tracked — true the instant a touch starts tracking, false once the
// release animation (commit or cancel) has actually finished. App.tsx
// uses this, and only this, to know when it's worth mounting a lightweight
// backdrop of the previous screen underneath — see its own comment for
// why that stays a small, additive, opt-in layer rather than a change to
// how any screen already renders.
//
// Touch listeners are attached with a real, manual addEventListener (see
// the effect below) rather than as onTouchStart/onTouchMove/... JSX props.
// React's own DOM renderer registers its one delegated touchstart/touchmove
// listener with { passive: true } unconditionally (react-dom's
// addTrappedEventListener hardcodes this for "touchstart"/"touchmove"/
// "wheel") — so a JSX onTouchMove handler's e.preventDefault() is silently
// ignored by the browser no matter what it does. That made every attempt
// to stop iOS's native scroll from here a no-op: the vertical list kept
// scrolling under a horizontal edge-swipe because nothing had ever actually
// told the browser not to. Attaching touchmove manually with
// { passive: false } is what makes preventDefault() real, which is what
// stops the native scroll gesture from engaging in the first place — the
// only point where it's actually possible to stop it (once iOS's own
// momentum/rubber-band scroll has taken over a touch, forcing scrollTop
// back from JS afterwards is unreliable, since the OS keeps driving the
// scroll offset itself for the rest of that touch).
const EDGE_ZONE_PX = 24;
const COMMIT_RATIO = 0.35; // fraction of screen width that counts as "far enough"
const COMMIT_VELOCITY_PX_MS = 0.5; // a fast flick commits even short of that distance
const ANIMATION_MS = 220;
const SHADOW = "-16px 0 32px rgba(0, 0, 0, 0.35)";

export function useSwipeBack(onBack: () => void, onActiveChange?: (active: boolean) => void) {
  const elRef = useRef<HTMLDivElement | null>(null);

  // Latest callbacks, read from inside the effect below without being part
  // of its dependency array — onBack/onActiveChange are freshly recreated
  // on most parent renders (e.g. popScreen is a new closure every render of
  // WatchlistApp), and re-running the effect on every one of those would
  // tear down and re-attach the native listeners mid-gesture if a re-render
  // happened to land during an active touch.
  const onBackRef = useRef(onBack);
  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => {
    onBackRef.current = onBack;
    onActiveChangeRef.current = onActiveChange;
  }, [onBack, onActiveChange]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const startX = { current: null as number | null };
    const startY = { current: null as number | null };
    const startTime = { current: 0 };
    const trackWidth = { current: 0 };
    const tracking = { current: false };
    const finishTimer = { current: null as ReturnType<typeof setTimeout> | null };
    const transitionEndCleanup = { current: null as (() => void) | null };
    // Pins the screen's own scrollable content (".app-screen__scroll", if it
    // has one) at whatever scrollTop it was at the moment a drag was
    // confirmed horizontal, and re-asserts that value on every subsequent
    // touchmove for the rest of the gesture — a defensive backstop on top
    // of the now-real preventDefault() below, costing nothing when there's
    // no scrollable descendant (querySelector returns null) or nothing
    // tried to move it (scrollTop already matches).
    const scrollLock = { current: null as { el: HTMLElement; top: number } | null };

    const setPosition = (px: number, animate: boolean) => {
      el.style.transition = animate ? `transform ${ANIMATION_MS}ms ease` : "none";
      el.style.transform = px > 0 ? `translateX(${px}px)` : "";
      el.style.boxShadow = px > 0 ? SHADOW : "";
    };

    // The single "this didn't result in going back" path — stops tracking,
    // clears the start point, and always animates the screen cleanly back
    // to rest, however far it had already moved. Used for a below-threshold
    // release, movement turning vertical, and a native touchcancel alike,
    // so none of them can ever leave the screen part-way translated.
    const cancelGesture = () => {
      tracking.current = false;
      startX.current = null;
      startY.current = null;
      // Belt-and-suspenders: the lock was already being re-asserted on
      // every move, so this is a no-op in practice — but it guarantees the
      // exact pre-gesture scroll position even if some move slipped through.
      if (scrollLock.current) {
        scrollLock.current.el.scrollTop = scrollLock.current.top;
        scrollLock.current = null;
      }
      setPosition(0, true);
      if (finishTimer.current) clearTimeout(finishTimer.current);
      finishTimer.current = setTimeout(() => onActiveChangeRef.current?.(false), ANIMATION_MS);
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;
      if (!touch || touch.clientX > EDGE_ZONE_PX || target?.closest('[aria-modal="true"]')) {
        tracking.current = false;
        return;
      }
      if (finishTimer.current) {
        clearTimeout(finishTimer.current);
        finishTimer.current = null;
      }
      scrollLock.current = null;
      trackWidth.current = el.getBoundingClientRect().width || window.innerWidth;
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      startTime.current = Date.now();
      tracking.current = true;
      onActiveChangeRef.current?.(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || startX.current === null || startY.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical intent dominates — cancel cleanly (see cancelGesture)
        // rather than just dropping tracking, so any horizontal distance
        // already covered gets animated back to rest instead of freezing
        // there. Never preventDefault here, so normal scrolling takes over
        // this touch immediately.
        cancelGesture();
        return;
      }
      // A confirmed horizontal edge-drag in progress — stop the browser
      // from doing anything else with it (e.g. a rubber-band flinch or
      // scrolling the list underneath), and follow the finger exactly,
      // clamped to [0, screen width]. Only ever the X axis; deltaY is
      // compared above, never written to transform. This preventDefault()
      // is only effective because this listener was attached manually with
      // { passive: false } below — see the hook's own top comment.
      e.preventDefault();
      if (!scrollLock.current) {
        const scrollEl = el.querySelector<HTMLElement>(".app-screen__scroll");
        if (scrollEl) scrollLock.current = { el: scrollEl, top: scrollEl.scrollTop };
      }
      if (scrollLock.current) {
        scrollLock.current.el.scrollTop = scrollLock.current.top;
      }
      const clamped = Math.max(0, Math.min(deltaX, trackWidth.current));
      setPosition(clamped, false);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking.current || startX.current === null) return;
      const originX = startX.current;
      const elapsedMs = Math.max(1, Date.now() - startTime.current);
      const touch = e.changedTouches[0];
      const deltaX = touch
        ? Math.max(0, Math.min(touch.clientX - originX, trackWidth.current))
        : 0;
      const velocity = deltaX / elapsedMs;

      const shouldCommit =
        trackWidth.current > 0 &&
        (deltaX > trackWidth.current * COMMIT_RATIO || velocity > COMMIT_VELOCITY_PX_MS);

      if (shouldCommit) {
        tracking.current = false;
        startX.current = null;
        startY.current = null;
        scrollLock.current = null;
        setPosition(trackWidth.current, true);
        // Keep reporting "active" (the backdrop stays mounted) through the
        // whole completion slide, so there's never a frame with neither the
        // backdrop nor the real next screen visible — only once onBack()
        // has actually changed the stack does the backdrop stop being
        // needed at all.
        //
        // The handoff itself waits for the real `transitionend` of this
        // translateX, not a setTimeout guessed to match ANIMATION_MS: a
        // timer fires at-or-after its delay, but the CSS transition it's
        // meant to track only starts on the next paint after the style
        // change above, so the timer can fire a frame or more before the
        // slide has actually finished. transitionend fires exactly when the
        // browser has finished animating that property. The timer becomes
        // a fallback only (interrupted transition, reduced-motion collapsing
        // it, the target value happening to already match, etc.), set
        // comfortably past ANIMATION_MS so it never fires first in the
        // normal case.
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          transitionEndCleanup.current = null;
          if (finishTimer.current) {
            clearTimeout(finishTimer.current);
            finishTimer.current = null;
          }
          // The dragged screen's box-shadow blurs outward past its own left
          // edge — even fully off-screen to the right, that blur (offset
          // -16px, 32px of blur) still reaches back roughly 48px into the
          // visible viewport. Clearing it here, synchronously, the moment
          // the slide is confirmed complete, makes it vanish exactly when
          // the screen finishes sliding rather than at whatever later
          // moment React gets around to actually unmounting this div.
          el.style.boxShadow = "";
          onBackRef.current();
          onActiveChangeRef.current?.(false);
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

    // A native touchcancel (the OS/browser interrupting the touch sequence
    // — an incoming call, a system gesture taking over, etc.) must reset
    // exactly like any other non-commit ending, or the screen could be left
    // stuck part-way translated with no touchend ever coming to clean it up.
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
