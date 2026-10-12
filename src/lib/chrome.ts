import { site } from "../config";
import { blurSwap } from "./blurSwap";
import { startClock } from "./clock";
import { escapeHtml as e, html, required } from "./dom";
import { bindMobileMenu, bindNavArrow } from "./menu";
import { setScrollLock } from "./smoothScroll";
import { bindSoundToggle } from "./sound";
import { bindTransitionLinks } from "./transition";

export type PanelSection = "about" | "contact";

const homeLabel = e(site.introName.join(" "));

const navItems = (homeHref: string) => `
  <li><a class="nav__item" href="${homeHref}" data-transition data-transition-label="${homeLabel}" data-nav-item aria-current="page">Work</a></li>
  <li><button type="button" class="nav__item" data-nav-item data-open-panel="about">About</button></li>
  <li><button type="button" class="nav__item" data-nav-item data-soon>Playground</button></li>
  <li><button type="button" class="nav__item" data-nav-item data-open-panel="contact">Contact</button></li>`;

const soundButton = () => `
  <button type="button" class="sound" data-sound aria-pressed="false" aria-label="Toggle page sound">
    <span class="sound__label">Audio</span>
    <span class="sound__state" data-sound-state>Off</span>
    <span class="sound__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  </button>`;

const contact = () => `
  <p class="contact">
    <span class="contact__label">Find me on</span>
    ${site.socials
      .map((link) => `<a class="contact__link" href="${e(link.href)}" target="_blank" rel="noreferrer">${e(link.label)}</a>`)
      .join(" ")}
  </p>`;

const clock = () => `
  <p class="clock"><span class="clock__label">Working globally</span><span class="clock__time" data-clock></span></p>`;

function chromeMarkup(homeHref: string): string {
  const year = new Date().getFullYear();
  const socials = site.socials
    .map(
      (link) => `<li><a href="${e(link.href)}" target="_blank" rel="noreferrer">
        <span class="panel__link-note">${e(link.note)}</span><span class="panel__link-label">${e(link.label)}</span></a></li>`,
    )
    .join("");
  const credits = site.credits
    .map((credit) => `<div><dt>${e(credit.role)}</dt><dd>${e(credit.name)}</dd></div>`)
    .join("");

  return `
  <aside class="brand" data-reveal style="--reveal-delay: 0ms">
    <a class="brand__logo" href="${homeHref}" data-transition data-transition-label="${homeLabel}" aria-label="${e(site.name)} home">${e(site.brand)}<sup>©</sup></a>
    <p class="brand__meta"><span>copyright ${year}</span><span>${e(site.cityCode)}</span><span>${e(site.phonePrefix)}</span></p>
  </aside>

  <header class="topbar">
    <nav class="nav" aria-label="Primary" data-nav data-reveal style="--reveal-delay: 60ms">
      <span class="nav__label">Menu</span>
      <div class="nav__body">
        <span class="nav__arrow" data-nav-arrow aria-hidden="true">→</span>
        <ul class="nav__list">${navItems(homeHref)}</ul>
      </div>
    </nav>
    <div class="topbar__sound" data-reveal style="--reveal-delay: 120ms">${soundButton()}</div>
    <div class="topbar__clock" data-reveal style="--reveal-delay: 160ms">${clock()}</div>
    <div class="topbar__contact" data-reveal style="--reveal-delay: 200ms">${contact()}</div>
  </header>

  <div class="mobilebar">
    <button type="button" class="menu-button" data-menu-button aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu">
      <span></span><span></span>
    </button>
    <a class="mobilebar__logo" href="${homeHref}" data-transition data-transition-label="${homeLabel}" aria-label="${e(site.name)} home">${e(site.brand)}<sup>©</sup></a>
  </div>

  <div class="mobile-menu" id="mobile-menu" data-mobile-menu hidden>
    <ul class="mobile-menu__list">${navItems(homeHref)}</ul>
    <div class="mobile-menu__meta">${soundButton()}${clock()}${contact()}</div>
  </div>

  <div class="panel" data-panel hidden>
    <div class="panel__backdrop" data-panel-close></div>
    <aside class="panel__sheet" role="dialog" aria-modal="true" aria-labelledby="panel-about-title">
      <button type="button" class="panel__close" data-panel-close>Close</button>
      <section class="panel__section" data-panel-section="about">
        <h2 class="panel__title" id="panel-about-title">About</h2>
        <p class="panel__text">${e(site.about)}</p>
        <p class="panel__role">${e(site.role)} — ${e(site.city)}</p>
      </section>
      <section class="panel__section" data-panel-section="contact">
        <h2 class="panel__title">Say hello</h2>
        <ul class="panel__links">${socials}</ul>
      </section>
      <section class="panel__section panel__credits">
        <h3 class="panel__subtitle">Credits</h3>
        <dl>${credits}</dl>
      </section>
    </aside>
  </div>`;
}

export interface Chrome {
  openPanel(section: PanelSection): void;
}

export function mountChrome(options: { homeHref: string }): Chrome {
  document.body.prepend(html(chromeMarkup(options.homeHref)));
  bindTransitionLinks();

  document.querySelectorAll<HTMLElement>("[data-nav]").forEach(bindNavArrow);
  document.querySelectorAll<HTMLButtonElement>("[data-sound]").forEach(bindSoundToggle);
  startClock([...document.querySelectorAll<HTMLElement>("[data-clock]")]);
  bindMobileMenu(
    required<HTMLButtonElement>(document, "[data-menu-button]"),
    required<HTMLElement>(document, "[data-mobile-menu]"),
  );
  bindSoonLabels();

  const panel = required<HTMLElement>(document, "[data-panel]");
  const sheet = required<HTMLElement>(panel, ".panel__sheet");
  let closeTimer = 0;

  const openPanel = (section: PanelSection) => {
    window.clearTimeout(closeTimer);
    setScrollLock(true);
    panel.hidden = false;
    const target = panel.querySelector<HTMLElement>(`[data-panel-section="${section}"]`);
    window.requestAnimationFrame(() => {
      panel.classList.add("is-open");
      sheet.scrollTo({ top: target ? target.offsetTop - 32 : 0, behavior: "instant" });
      required<HTMLButtonElement>(panel, ".panel__close").focus({ preventScroll: true });
    });
  };

  const closePanel = () => {
    if (panel.hidden) return;
    panel.classList.remove("is-open");
    closeTimer = window.setTimeout(() => {
      panel.hidden = true;
      setScrollLock(false);
    }, 650);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const opener = target?.closest<HTMLElement>("[data-open-panel]");
    if (opener) openPanel(opener.dataset.openPanel === "contact" ? "contact" : "about");
    else if (target?.closest("[data-panel-close]")) closePanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePanel();
  });

  return { openPanel };
}

/** "Playground" is not built: its label briefly answers "Soon". */
function bindSoonLabels(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-soon]").forEach((button) => {
    const label = button.textContent ?? "";
    let timer = 0;
    button.addEventListener("click", () => {
      window.clearTimeout(timer);
      blurSwap(button, () => {
        button.textContent = "Soon";
      });
      timer = window.setTimeout(() => {
        blurSwap(button, () => {
          button.textContent = label;
        });
      }, 1400);
    });
  });
}
