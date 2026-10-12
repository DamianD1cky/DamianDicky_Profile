import { setScrollLock } from "./smoothScroll";

/** Moves the nav arrow to the hovered item and back to the current page on leave. */
export function bindNavArrow(nav: HTMLElement): void {
    const arrow = nav.querySelector<HTMLElement>("[data-nav-arrow]");
    const items = [...nav.querySelectorAll<HTMLElement>("[data-nav-item]")];
    const current =
        items.find((item) => item.getAttribute("aria-current") === "page") ??
        items[0];
    if (!arrow || !current) return;

    const pointAt = (item: HTMLElement) => {
        arrow.style.transform = `translate3d(0, ${item.offsetTop}px, 0)`;
        for (const other of items)
            other.classList.toggle("is-pointed", other === item);
    };

    for (const item of items) {
        item.addEventListener("pointerenter", () => pointAt(item));
        item.addEventListener("focus", () => pointAt(item));
    }
    nav.addEventListener("pointerleave", () => pointAt(current));
    nav.addEventListener("focusout", (event) => {
        if (!nav.contains(event.relatedTarget as Node | null)) pointAt(current);
    });
    pointAt(current);
}

/** Two-line button that morphs into a cross and toggles the full-screen menu. */
export function bindMobileMenu(
    button: HTMLButtonElement,
    overlay: HTMLElement,
): void {
    let closeTimer = 0;

    const setOpen = (open: boolean) => {
        if ((button.getAttribute("aria-expanded") === "true") === open) return;
        button.setAttribute("aria-expanded", String(open));
        button.classList.toggle("is-open", open);
        setScrollLock(open);
        window.clearTimeout(closeTimer);
        if (open) {
            overlay.hidden = false;
            window.requestAnimationFrame(() =>
                overlay.classList.add("is-open"),
            );
        } else {
            overlay.classList.remove("is-open");
            closeTimer = window.setTimeout(() => {
                overlay.hidden = true;
            }, 600);
        }
    };

    button.addEventListener("click", () =>
        setOpen(button.getAttribute("aria-expanded") !== "true"),
    );
    overlay.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("a, [data-close-menu], [data-open-panel]"))
            setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
    });
}
