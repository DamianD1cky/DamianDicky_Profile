import { Matrix4, Vector3 } from "three";
import { clamp, lerp } from "../lib/math";

export const STAGE = {
  /** Visible world height of the orthographic camera. */
  frustumHeight: 10.8,
  cameraPosition: new Vector3(20, 12.1, 16.6),
  cameraTarget: new Vector3(-7, -2.1, 1.3),
  meshRotation: [-0.0215, 2.2884, 0.2884] as const,
  /** Extra distance, in page gaps, pushed between the focused page and its neighbours. */
  centerSpacing: 7,
  /** Turn applied to the focused page so it faces the camera (radians). */
  focusTurn: { x: 0.06681, y: -0.36331, z: -0.51318 },
  /** The page face sits this far behind its spine. */
  spineDepth: 1,
  /** Pages are repeated until the loop holds at least this many, so it never runs dry on screen. */
  minPages: 30,
  /** Gap between stacked pages while the intro magazine is still closed. */
  closedSpread: 0.05,
};

export interface RibbonConfig {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly meshPosition: readonly [number, number, number];
  /** Strength of the page curl while scrolling. */
  readonly scrollCurve: number;
  readonly parallax: boolean;
}

const WIDE: RibbonConfig = {
  pageWidth: 4.492,
  pageHeight: 3.658,
  meshPosition: [4.3, 2.1, 5.1],
  scrollCurve: 2.25,
  parallax: true,
};

const COMPACT: RibbonConfig = {
  pageWidth: 3,
  pageHeight: 2,
  meshPosition: [3.8, 2.1, 5.1],
  scrollCurve: 1.15,
  parallax: false,
};

export const configFor = (viewportWidth: number): RibbonConfig => (viewportWidth < 1024 ? COMPACT : WIDE);

export const pageCountFor = (projectCount: number): number =>
  projectCount * Math.max(1, Math.ceil(STAGE.minPages / projectCount));

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Folds `value` into [-period / 2, period / 2). */
export const wrapCentered = (value: number, period: number): number =>
  value - period * Math.floor(value / period + 0.5);

export interface IntroState {
  /** 0 = closed stack, 1 = pages spread one gap apart. */
  readonly spread: number;
  /** 0 = no centre gap or focus turn, 1 = fully settled. */
  readonly settle: number;
}

export interface PageState {
  /** Pages already passed are positive (upper right), upcoming pages negative (lower left). */
  readonly offset: number;
  /** Position along the stack axis after the centre push. */
  readonly slot: number;
  /** 1 for the page in the centre, falling to 0 within 0.8 of a gap. */
  readonly focus: number;
}

export function pageState(page: number, position: number, pageCount: number, intro: IntroState): PageState {
  const offset = wrapCentered(position - page, pageCount);
  const distance = Math.abs(offset);
  const push = smoothstep(0.1, 0.9, distance) * STAGE.centerSpacing * intro.settle;
  const spread = lerp(STAGE.closedSpread, 1, intro.spread);
  return {
    offset,
    slot: offset * spread + Math.sign(offset) * push,
    focus: smoothstep(0, 1, 1 - smoothstep(0, 0.8, distance)) * intro.settle,
  };
}

const standUp = new Matrix4().makeRotationY(Math.PI / 2);
const focusMatrix = new Matrix4();
const step = new Matrix4();

/**
 * Instance matrix for one page plane (centred at the origin, facing +z):
 * the page is stood up on a spine that runs along the stack axis at `slot`,
 * then the focused page turns about a point on that axis to face the camera.
 */
export function pageMatrix(out: Matrix4, state: PageState, config: RibbonConfig, lift: number): Matrix4 {
  const halfWidth = config.pageWidth / 2;
  out.makeTranslation(state.slot, lift, -halfWidth - STAGE.spineDepth).multiply(standUp);
  if (state.focus > 0) {
    const { x, y, z } = STAGE.focusTurn;
    const f = state.focus;
    focusMatrix
      .makeTranslation(halfWidth, 0, 0)
      .multiply(step.makeRotationZ(z * f))
      .multiply(step.makeRotationY(-y * f))
      .multiply(step.makeRotationX(-x * f))
      .multiply(step.makeTranslation(-halfWidth, 0, 0));
    out.premultiply(focusMatrix);
  }
  return out;
}
