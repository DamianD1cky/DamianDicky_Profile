import { clamp } from "./math";
import { prefersReducedMotion } from "./motion";

export const isScrollLocked = (): boolean => document.documentElement.dataset.scrollLock === "true";

export function setScrollLock(locked: boolean): void {
  if (locked) document.documentElement.dataset.scrollLock = "true";
  else delete document.documentElement.dataset.scrollLock;
}

export interface SmoothScrollOptions {
  /** Share of the remaining distance covered per 60 Hz frame. */
  readonly ease?: number;
  readonly wheelMultiplier?: number;
  /** Largest distance a single wheel event may add. */
  readonly maxWheelStep?: number;
}

export interface SmoothScroller {
  scrollTo(top: number): void;
  scrollBy(distance: number): void;
}

const LINE_STEP = 80;

/**
 * Drives one scroll container from wheel and keyboard input anywhere on the page,
 * so fixed overlays never swallow scrolling. Input moves a target; each frame the
 * container covers a share of the remaining distance. Touch scrolling stays native.
 */
export function createSmoothScroller(element: HTMLElement, options: SmoothScrollOptions = {}): SmoothScroller {
  const ease = options.ease ?? 0.075;
  const wheelMultiplier = options.wheelMultiplier ?? 1.15;
  const maxWheelStep = options.maxWheelStep ?? 240;
  const smooth = !prefersReducedMotion();

  let current = element.scrollTop;
  let target = current;
  let frame = 0;
  let lastTime = 0;

  const maxScroll = () => Math.max(0, element.scrollHeight - element.clientHeight);

  const tick = (time: number) => {
    const dt = lastTime ? Math.min(64, time - lastTime) : 1000 / 60;
    lastTime = time;
    target = clamp(target, 0, maxScroll());
    current += (target - current) * (1 - (1 - ease) ** (dt / (1000 / 60)));
    if (Math.abs(target - current) < 0.25) current = target;
    element.scrollTop = current;
    if (current === target) {
      frame = 0;
      lastTime = 0;
    } else {
      frame = window.requestAnimationFrame(tick);
    }
  };

  const scrollBy = (distance: number) => {
    if (!frame) {
      current = element.scrollTop;
      target = current;
    }
    target = clamp(target + distance, 0, maxScroll());
    if (!smooth) {
      element.scrollTop = target;
      current = target;
      return;
    }
    if (!frame) frame = window.requestAnimationFrame(tick);
  };

  const scrollTo = (top: number) => scrollBy(top - (frame ? target : element.scrollTop));

  window.addEventListener(
    "wheel",
    (event) => {
      if (event.defaultPrevented || event.ctrlKey || isScrollLocked()) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (scrollsElsewhere(event.target, event.deltaY, element)) return;
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientHeight
            : 1;
      scrollBy(clamp(event.deltaY * unit * wheelMultiplier, -maxWheelStep, maxWheelStep));
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (isScrollLocked() || event.altKey || event.metaKey || event.ctrlKey) return;
    const focus = event.target instanceof HTMLElement ? event.target : null;
    if (focus?.closest("input, textarea, select, button, [contenteditable='true']")) return;
    const page = element.clientHeight * 0.85;
    const distances: Record<string, number> = {
      ArrowDown: LINE_STEP,
      ArrowUp: -LINE_STEP,
      PageDown: page,
      PageUp: -page,
      " ": event.shiftKey ? -page : page,
    };
    if (event.key === "Home") scrollTo(0);
    else if (event.key === "End") scrollTo(maxScroll());
    else if (event.key in distances) scrollBy(distances[event.key] ?? 0);
    else return;
    event.preventDefault();
  });

  // Touch and scrollbar scrolling move the element directly; follow them.
  element.addEventListener(
    "scroll",
    () => {
      if (frame) return;
      current = element.scrollTop;
      target = current;
    },
    { passive: true },
  );

  return { scrollTo, scrollBy };
}

/** True when another scrollable area under the pointer can still move in that direction. */
function scrollsElsewhere(target: EventTarget | null, deltaY: number, scroller: HTMLElement): boolean {
  let element = target instanceof Element ? target : null;
  while (element && element !== scroller && element !== document.body) {
    if (element instanceof HTMLElement && element.scrollHeight > element.clientHeight + 1) {
      const overflow = window.getComputedStyle(element).overflowY;
      if (overflow === "auto" || overflow === "scroll") {
        const atTop = element.scrollTop <= 0;
        const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
        if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
      }
    }
    element = element.parentElement;
  }
  return false;
}
