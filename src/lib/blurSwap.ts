import { EASE_OUT, prefersReducedMotion } from "./motion";

const pendingUpdates = new WeakMap<Element, () => void>();
const leaving = new WeakSet<Element>();
const entering = new WeakMap<Element, Animation>();

const OUT: Keyframe[] = [
    { opacity: 0, filter: "blur(8px)", transform: "translate3d(0, -0.2em, 0)" },
];
const IN: Keyframe[] = [
    { opacity: 0, filter: "blur(10px)", transform: "translate3d(0, 0.3em, 0)" },
    { opacity: 1, filter: "blur(0px)", transform: "translate3d(0, 0, 0)" },
];

/**
 * Blurs an element out, applies `update`, then blurs it back in.
 * Calls made while the element is still leaving collapse into the latest update.
 */
export function blurSwap(element: HTMLElement, update: () => void): void {
    if (prefersReducedMotion()) {
        update();
        return;
    }
    pendingUpdates.set(element, update);
    if (leaving.has(element)) return;
    leaving.add(element);

    const enteringAnimation = entering.get(element);
    if (enteringAnimation) {
        // commitStyles throws for elements that are not rendered (e.g. hidden on compact layouts).
        if (element.getClientRects().length > 0)
            enteringAnimation.commitStyles();
        enteringAnimation.cancel();
        entering.delete(element);
    }

    const out = element.animate(OUT, {
        duration: 170,
        easing: "ease-in",
        fill: "forwards",
    });
    out.finished.then(
        () => {
            leaving.delete(element);
            pendingUpdates.get(element)?.();
            pendingUpdates.delete(element);
            element.style.removeProperty("opacity");
            element.style.removeProperty("filter");
            element.style.removeProperty("transform");
            out.cancel();
            const animation = element.animate(IN, {
                duration: 560,
                easing: EASE_OUT,
            });
            entering.set(element, animation);
            animation.finished.then(
                () => {
                    if (entering.get(element) === animation)
                        entering.delete(element);
                },
                () => undefined,
            );
        },
        () => leaving.delete(element),
    );
}
