import { site } from "../config";
import { blurSwap } from "./blurSwap";
import { startClock } from "./clock";
import { escapeHtml as e, html, required } from "./dom";
import { bindMobileMenu, bindNavArrow } from "./menu";
import { setScrollLock } from "./smoothScroll";
import { bindSoundToggle } from "./sound";
import { bindTransitionLinks } from "./transition";

export type ChromePage = "work" | "about";

const homeLabel = e(site.introName.join(" "));

const currentAttribute = (active: boolean) => (active ? ' aria-current="page"' : "");
const contextualAboutHref = (homeHref: string): string => {
  const work = new URL(homeHref, window.location.href).searchParams.get("work");
  return work ? `/about.html?work=${encodeURIComponent(work)}` : "/about.html";
};

const navItems = (homeHref: string, aboutHref: string, current: ChromePage) => `
  <li><a class="nav__item" href="${homeHref}" data-work-link data-transition data-transition-label="${homeLabel}" data-nav-item${currentAttribute(current === "work")}>Work</a></li>
  <li><a class="nav__item" href="${aboutHref}" data-about-link data-transition data-transition-label="ABOUT" data-nav-item${currentAttribute(current === "about")}>About</a></li>
  <li><button type="button" class="nav__item" data-nav-item data-soon>Playground</button></li>
  <li><button type="button" class="nav__item" data-nav-item data-open-contact>Contact</button></li>`;

const soundButton = () => `
  <button type="button" class="sound" data-sound aria-pressed="false" aria-label="Toggle page sound">
    <span class="sound__label">Audio</span>
    <span class="sound__state" data-sound-state>Off</span>
    <span class="sound__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  </button>`;

const contactLinks = () => `
  <p class="contact">
    <span class="contact__label">Find me on</span>
    ${site.socials
      .map(
        (link) =>
          `<a class="contact__link" href="${e(link.href)}" target="_blank" rel="noreferrer">${e(link.label)}</a>`,
      )
      .join(" ")}
  </p>`;

const clock = () => `
  <p class="clock"><span class="clock__label">Working globally</span><span class="clock__time" data-clock></span></p>`;

const closeIcon = () => `<span class="close-icon" aria-hidden="true"><i></i><i></i></span>`;

function chromeMarkup(options: { homeHref: string; aboutHref: string; current: ChromePage }): string {
  const year = new Date().getFullYear();
  const socialGroups = site.socials
    .map(
      (link) => `<li class="contact-card__group">
        <span>${e(link.note)}</span>
        <a href="${e(link.href)}" target="_blank" rel="noreferrer">${e(link.label)}</a>
      </li>`,
    )
    .join("");
  const credits = site.credits
    .map((credit) => `<div><dt>${e(credit.role)}</dt><dd>${e(credit.name)}</dd></div>`)
    .join("");
  const items = navItems(options.homeHref, options.aboutHref, options.current);

  return `
  <aside class="brand" data-reveal style="--reveal-delay: 0ms">
    <a class="brand__logo" href="${options.homeHref}" data-work-link data-transition data-transition-label="${homeLabel}" aria-label="${e(site.name)} home">${e(site.brand)}<sup>©</sup></a>
    <p class="brand__meta"><span>copyright ${year}</span><span>${e(site.cityCode)}</span><span>${e(site.phonePrefix)}</span></p>
  </aside>

  <header class="topbar">
    <nav class="nav" aria-label="Primary" data-nav data-reveal style="--reveal-delay: 60ms">
      <span class="nav__label">Menu</span>
      <div class="nav__body">
        <span class="nav__arrow" data-nav-arrow aria-hidden="true">→</span>
        <ul class="nav__list">${items}</ul>
      </div>
    </nav>
    <div class="topbar__sound" data-reveal style="--reveal-delay: 120ms">${soundButton()}</div>
    <div class="topbar__clock" data-reveal style="--reveal-delay: 160ms">${clock()}</div>
    <div class="topbar__contact" data-reveal style="--reveal-delay: 200ms">${contactLinks()}</div>
  </header>

  <div class="mobilebar">
    <button type="button" class="menu-button" data-menu-button aria-expanded="false" aria-controls="mobile-menu" aria-label="Menu">
      <span></span><span></span>
    </button>
    <a class="mobilebar__logo" href="${options.homeHref}" data-work-link data-transition data-transition-label="${homeLabel}" aria-label="${e(site.name)} home">${e(site.brand)}<sup>©</sup></a>
  </div>

  <div class="mobile-menu" id="mobile-menu" data-mobile-menu hidden>
    <ul class="mobile-menu__list">${items}</ul>
    <div class="mobile-menu__meta">${soundButton()}${clock()}${contactLinks()}</div>
  </div>

  <div class="contact-overlay" data-contact-overlay hidden>
    <div class="contact-overlay__dismiss" data-contact-close></div>
    <aside class="credits-card" aria-label="Credits">
      <h3>Credits</h3>
      <dl>${credits}</dl>
      <span class="credits-card__mark" aria-hidden="true">DD</span>
    </aside>
    <section class="contact-card" role="dialog" aria-modal="true" aria-labelledby="contact-title">
      <h2 id="contact-title">Come say hi</h2>
      <ul class="contact-card__links">${socialGroups}</ul>
      <button type="button" class="contact-card__close" data-contact-close><span>Close</span>${closeIcon()}</button>
    </section>
  </div>`;
}

export interface Chrome {
  openContact(): void;
  closeContact(): void;
  setWorkHref(href: string): void;
}

export function mountChrome(options: {
  homeHref: string;
  aboutHref?: string;
  current?: ChromePage;
}): Chrome {
  document.body.prepend(
    html(
      chromeMarkup({
        homeHref: options.homeHref,
        aboutHref: options.aboutHref ?? contextualAboutHref(options.homeHref),
        current: options.current ?? "work",
      }),
    ),
  );
  bindTransitionLinks();

  document.querySelectorAll<HTMLElement>("[data-nav]").forEach(bindNavArrow);
  document.querySelectorAll<HTMLButtonElement>("[data-sound]").forEach(bindSoundToggle);
  startClock([...document.querySelectorAll<HTMLElement>("[data-clock]")]);
  const menuButton = required<HTMLButtonElement>(document, "[data-menu-button]");
  bindMobileMenu(menuButton, required<HTMLElement>(document, "[data-mobile-menu]"));
  bindSoonLabels();

  const overlay = required<HTMLElement>(document, "[data-contact-overlay]");
  let closeTimer = 0;
  let returnFocus: HTMLElement | null = null;

  const openContact = (opener?: HTMLElement) => {
    if (overlay.classList.contains("is-open")) return;
    window.clearTimeout(closeTimer);
    returnFocus = opener?.closest("[data-mobile-menu]")
      ? menuButton
      : opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setScrollLock(true);
    overlay.hidden = false;
    window.requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      required<HTMLButtonElement>(overlay, ".contact-card__close").focus({ preventScroll: true });
    });
  };

  const closeContact = () => {
    if (overlay.hidden) return;
    overlay.classList.remove("is-open");
    returnFocus?.focus({ preventScroll: true });
    closeTimer = window.setTimeout(() => {
      overlay.hidden = true;
      setScrollLock(false);
    }, 850);
  };

  const setWorkHref = (href: string) => {
    const aboutHref = contextualAboutHref(href);
    document.querySelectorAll<HTMLAnchorElement>("[data-work-link]").forEach((link) => {
      link.href = href;
    });
    document.querySelectorAll<HTMLAnchorElement>("[data-about-link]").forEach((link) => {
      link.href = aboutHref;
    });
  };
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const opener = target?.closest<HTMLElement>("[data-open-contact]");
    if (opener) openContact(opener);
    else if (target?.closest("[data-contact-close]")) closeContact();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeContact();
  });

  return { openContact, closeContact, setWorkHref };
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
