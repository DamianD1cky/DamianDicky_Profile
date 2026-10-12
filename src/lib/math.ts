export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dtSeconds: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dtSeconds));

export const wrapIndex = (index: number, length: number): number =>
  ((index % length) + length) % length;

/** Signed offset of `index` from a fractional `position` on a loop of `length` items. */
export const loopOffset = (index: number, position: number, length: number): number => {
  let offset = index - wrapIndex(position, length);
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
};

export const pad2 = (value: number): string => String(value).padStart(2, "0");

/** Deterministic PRNG so placeholder art is stable between reloads. */
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
