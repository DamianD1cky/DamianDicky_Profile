import { escapeHtml, html, required } from "./dom";
import { pad2, wrapIndex } from "./math";
import { EASE_OUT, prefersReducedMotion } from "./motion";
import { setScrollLock } from "./smoothScroll";

export interface LightboxItem {
    readonly src: string;
    readonly alt: string;
    readonly caption: string;
}

const SWIPE_DISTANCE = 48;

/** Full-screen viewer with previous/next, keyboard, swipe, and blur-swap media changes. */
export function openLightbox(
    items: readonly LightboxItem[],
    startIndex = 0,
): void {
    if (items.length === 0 || document.querySelector(".lightbox")) return;
    const reduce = prefersReducedMotion();
    const returnFocus =
        document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
    let index = wrapIndex(startIndex, items.length);
    let swapTimer = 0;

    const multiple = items.length > 1;
    const navButton = (side: "prev" | "next", label: string) =>
        multiple
            ? `<button type="button" class="lightbox__nav lightbox__nav--${side}" data-lightbox-${side}>
          <span>${label}</span><span class="lightbox__line" aria-hidden="true"><i></i></span>
        </button>`
            : "";

    const root = html(`
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
      <figure class="lightbox__frame">
        <img class="lightbox__media" alt="" />
        <figcaption class="lightbox__caption"></figcaption>
      </figure>
      ${navButton("prev", "Previous")}
      ${navButton("next", "Next")}
      <p class="lightbox__count" aria-live="polite"></p>
      <button type="button" class="lightbox__close" data-lightbox-close>Close</button>
    </div>`).firstElementChild as HTMLElement;

    const frame = required<HTMLElement>(root, ".lightbox__frame");
    const media = required<HTMLImageElement>(root, ".lightbox__media");
    const caption = required<HTMLElement>(root, ".lightbox__caption");
    const count = required<HTMLElement>(root, ".lightbox__count");

    const render = () => {
        const item = items[index];
        if (!item) return;
        media.src = item.src;
        media.alt = item.alt;
        caption.innerHTML = escapeHtml(item.caption);
        count.textContent = `${pad2(index + 1)} / ${pad2(items.length)}`;
        for (const neighbour of [
            items[wrapIndex(index - 1, items.length)],
            items[wrapIndex(index + 1, items.length)],
        ]) {
            if (neighbour) new Image().src = neighbour.src;
        }
    };

    const show = (direction: 1 | -1) => {
        if (!multiple) return;
        index = wrapIndex(index + direction, items.length);
        if (reduce) {
            render();
            return;
        }
        window.clearTimeout(swapTimer);
        frame.classList.add("is-swapping");
        swapTimer = window.setTimeout(() => {
            render();
            frame.classList.remove("is-swapping");
            media.animate(
                [
                    {
                        opacity: 0,
                        filter: "blur(8px)",
                        transform: "scale(0.975)",
                    },
                    { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
                ],
                { duration: 420, easing: EASE_OUT },
            );
        }, 160);
    };

    const close = () => {
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("wheel", blockScroll, true);
        window.removeEventListener("touchmove", blockScroll, true);
        root.classList.remove("is-visible");
        window.setTimeout(
            () => {
                root.remove();
                setScrollLock(false);
                returnFocus?.focus({ preventScroll: true });
            },
            reduce ? 0 : 280,
        );
    };

    const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") close();
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") show(-1);
        else if (event.key === "ArrowRight" || event.key === "ArrowDown")
            show(1);
        else return;
        event.preventDefault();
    };

    const blockScroll = (event: Event) => {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
    };

    let touchStart: { x: number; y: number } | null = null;
    root.addEventListener("touchstart", (event) => {
        const touch = event.touches[0];
        touchStart =
            touch && event.touches.length === 1
                ? { x: touch.clientX, y: touch.clientY }
                : null;
    });
    root.addEventListener("touchend", (event) => {
        const touch = event.changedTouches[0];
        if (!touchStart || !touch) return;
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        touchStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
        const forward = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0;
        show(forward ? 1 : -1);
    });

    root.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-lightbox-prev]")) show(-1);
        else if (target?.closest("[data-lightbox-next]")) show(1);
        else if (
            target?.closest("[data-lightbox-close]") ||
            !target?.closest(".lightbox__frame")
        )
            close();
    });

    document.addEventListener("keydown", onKey);
    window.addEventListener("wheel", blockScroll, {
        capture: true,
        passive: false,
    });
    window.addEventListener("touchmove", blockScroll, {
        capture: true,
        passive: false,
    });
    setScrollLock(true);
    render();
    document.body.append(root);
    window.requestAnimationFrame(() => root.classList.add("is-visible"));
    required<HTMLButtonElement>(root, "[data-lightbox-close]").focus({
        preventScroll: true,
    });
}
