import { clamp } from "../lib/math";
import { STAGE } from "./ribbonLayout";
import type { RibbonScroll } from "./ribbonScroll";

const MOUSE_SENSITIVITY = 0.7;
const MAX_MOUSE_PAGES = 4;
const TRACKPAD_SENSITIVITY = 0.21;
const MAX_TRACKPAD_STEP = 0.14;
const TOUCH_SENSITIVITY = 0.3;
/** Wheel input is damped on viewports larger than this. */
const REFERENCE_VIEWPORT = { width: 1512, height: 982 };

/** Converts a screen distance into pages, using the camera's world-per-pixel scale. */
const pixelsToPages = (pixels: number): number => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const damping = Math.min(
        1,
        REFERENCE_VIEWPORT.width / width,
        REFERENCE_VIEWPORT.height / height,
    );
    return pixels * (STAGE.frustumHeight / height) * damping;
};

const wheelPixels = (event: WheelEvent): number => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE)
        return event.deltaY * window.innerHeight;
    return event.deltaY;
};

/** Forward is down the wheel, down the keyboard, or a swipe up. */
export function bindRibbonInput(
    scroll: RibbonScroll,
    isBlocked: () => boolean,
): void {
    window.addEventListener(
        "wheel",
        (event) => {
            if (isBlocked() || event.ctrlKey) return;
            event.preventDefault();
            const pages = pixelsToPages(wheelPixels(event));
            if (pages === 0) return;
            // Trackpads send pixel deltas with sideways noise or small steps; mouse wheels send large notches.
            const trackpad =
                event.deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
                (event.deltaX !== 0 || Math.abs(event.deltaY) < 24);
            if (trackpad) {
                scroll.scrub(
                    clamp(
                        pages * TRACKPAD_SENSITIVITY,
                        -MAX_TRACKPAD_STEP,
                        MAX_TRACKPAD_STEP,
                    ),
                );
            } else {
                const notches = clamp(
                    Math.round(Math.abs(pages) * MOUSE_SENSITIVITY),
                    1,
                    MAX_MOUSE_PAGES,
                );
                scroll.moveBy(Math.sign(pages) * notches);
            }
        },
        { passive: false },
    );

    window.addEventListener("keydown", (event) => {
        if (isBlocked() || event.altKey || event.metaKey || event.ctrlKey)
            return;
        const target =
            event.target instanceof HTMLElement ? event.target : null;
        if (
            target?.closest("input, textarea, select, [contenteditable='true']")
        )
            return;
        const forward = ["ArrowDown", "ArrowRight", "PageDown", " "].includes(
            event.key,
        );
        const backward = ["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key);
        if (!forward && !backward) return;
        event.preventDefault();
        scroll.moveBy(forward ? 1 : -1);
    });

    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let touching = false;
    window.addEventListener(
        "touchstart",
        (event) => {
            const touch = event.touches[0];
            if (!touch || event.touches.length !== 1 || isBlocked()) return;
            touching = true;
            lastY = touch.clientY;
            lastTime = performance.now();
            velocity = 0;
            scroll.beginDrag();
        },
        { passive: true },
    );
    window.addEventListener(
        "touchmove",
        (event) => {
            const touch = event.touches[0];
            if (!touching || !touch) return;
            if (event.cancelable) event.preventDefault();
            const now = performance.now();
            const pages =
                pixelsToPages(lastY - touch.clientY) * TOUCH_SENSITIVITY;
            velocity = pages / Math.max(0.001, (now - lastTime) / 1000);
            lastY = touch.clientY;
            lastTime = now;
            scroll.drag(pages);
        },
        { passive: false },
    );
    const release = () => {
        if (!touching) return;
        touching = false;
        scroll.endDrag(performance.now() - lastTime > 120 ? 0 : velocity);
    };
    window.addEventListener("touchend", release);
    window.addEventListener("touchcancel", release);
}
