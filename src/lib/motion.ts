const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

export const prefersReducedMotion = (): boolean => reducedMotionQuery.matches;
export const isCoarsePointer = (): boolean => coarsePointerQuery.matches;

export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.7, 0, 0.2, 1)";

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

/** Resolves once web fonts settle, without blocking forever on a stalled font. */
export const fontsReady = (timeoutMs = 2500): Promise<void> =>
  Promise.race([document.fonts.ready.then(() => undefined), wait(timeoutMs)]);
