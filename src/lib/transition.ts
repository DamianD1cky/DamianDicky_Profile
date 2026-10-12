import { prefersReducedMotion } from "./motion";

// Must match public/boot-cover.js.
const FLAG_KEY = "damiandicky:transition";
const READY_EVENT = "damiandicky:page-ready";
const REVEAL_EVENT = "damiandicky:page-reveal";

const PANEL_RISE_MS = 1000;
/** The panel covers the screen for a beat before the next page starts loading. */
const NAVIGATE_AFTER_MS = 1700;

let leavingPage = false;

/** Lets the boot panel leave. Call once the page has rendered its first state. */
export function signalPageReady(): void {
  window.dispatchEvent(new Event(READY_EVENT));
}

/** Resolves when the boot panel starts uncovering the page; listen before `signalPageReady`. */
export function pageRevealed(): Promise<void> {
  return new Promise((resolve) => window.addEventListener(REVEAL_EVENT, () => resolve(), { once: true }));
}

/** Raises a dark panel, then loads the page; the next page shows `label` while it uncovers. */
export function navigateWithTransition(href: string, label: string): void {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  if (leavingPage) return;
  leavingPage = true;

  try {
    window.sessionStorage.setItem(FLAG_KEY, JSON.stringify({ t: Date.now(), label }));
  } catch {
    // Without storage the next page simply fades in.
  }
  if (prefersReducedMotion()) {
    window.location.assign(url.href);
    return;
  }

  const panel = document.createElement("div");
  panel.className = "leave-panel";
  panel.setAttribute("aria-hidden", "true");
  document.body.append(panel);
  panel.animate([{ transform: "translate3d(0, 100%, 0)" }, { transform: "translate3d(0, 0, 0)" }], {
    duration: PANEL_RISE_MS,
    easing: "cubic-bezier(0.42, 0, 0.1, 1)",
    fill: "forwards",
  });
  window.setTimeout(() => window.location.assign(url.href), NAVIGATE_AFTER_MS);
}

/** Intercepts plain left-clicks on `a[data-transition]`; `data-transition-label` names the destination. */
export function bindTransitionLinks(): void {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>("a[data-transition]");
    if (!link || link.target === "_blank") return;
    event.preventDefault();
    navigateWithTransition(link.href, link.dataset.transitionLabel ?? link.textContent?.trim() ?? "");
  });

  // Back/forward cache restores the page with the leave panel still attached.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    leavingPage = false;
    document.querySelectorAll(".leave-panel").forEach((panel) => panel.remove());
  });
}
