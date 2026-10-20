import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter-tight";
import "../styles/base.css";
import "../styles/about.css";

import { site } from "../config";
import { findProject, projects } from "../data/projects";
import { mountChrome } from "../lib/chrome";
import { escapeHtml as e, html, required } from "../lib/dom";
import { fontsReady } from "../lib/motion";
import { setScrollLock } from "../lib/smoothScroll";
import { pageRevealed, signalPageReady } from "../lib/transition";

const workIndex = findProject(new URLSearchParams(window.location.search).get("work"));
const workProject = projects[workIndex];
const homeHref =
  workIndex === 0 || !workProject ? "/" : `/?work=${encodeURIComponent(workProject.slug)}`;

const root = required<HTMLElement>(document, "[data-about]");
const list = (values: readonly string[]) => values.map((value) => `<li>${e(value)}</li>`).join("");
const socialLinks = site.socials
  .map(
    (link) =>
      `<li><a href="${e(link.href)}" target="_blank" rel="noreferrer">${e(link.label)}</a><span>${e(link.note)}</span></li>`,
  )
  .join("");
const processRows = site.process
  .map(
    (item) => `<div class="process-card__row">
      <span>${e(item.code)}</span>
      <h3>${e(item.title)}</h3>
      <p>${e(item.body)}</p>
    </div>`,
  )
  .join("");

root.append(
  html(`
    <div class="about__page">
      <section class="about__hero" aria-labelledby="about-title">
        <h1 class="sr-only" id="about-title">About ${e(site.name)}</h1>
        <p class="about__traits" data-reveal style="--reveal-delay: 160ms">${site.aboutTraits.map((item) => `<span>${e(item)}</span>`).join("")}</p>
        <div class="about__mark" aria-hidden="true" data-reveal style="--reveal-delay: 220ms">
          <span>AI</span>
          <span class="about__portrait">DD</span>
          <small>and</small>
          <span>WEB</span>
        </div>
        <p class="about__statement" data-reveal style="--reveal-delay: 280ms">${e(site.aboutStatement)}</p>
        <div class="about__index" data-reveal style="--reveal-delay: 340ms">
          <section>
            <h2>Current focus</h2>
            <ul>${list(site.focus)}</ul>
          </section>
          <section>
            <h2>Notes & experiments</h2>
            <ul class="about__links">${socialLinks}</ul>
          </section>
          <section>
            <h2>Capabilities</h2>
            <ul>${list(site.capabilities)}</ul>
            <button type="button" class="about__process-link" data-open-process>Process & Approach</button>
          </section>
          <section class="about__location">
            <h2>Working from</h2>
            <p>${e(site.city)}</p>
            <p>Available globally</p>
          </section>
        </div>
      </section>
    </div>

    <div class="process-overlay" data-process-overlay hidden>
      <div class="process-overlay__dismiss" data-process-close></div>
      <section class="process-card" role="dialog" aria-modal="true" aria-labelledby="process-title">
        <header class="process-card__header">
          <h2 id="process-title">Approach</h2>
          <span>How ideas become working systems</span>
        </header>
        <p class="process-card__lead">${e(site.about)}</p>
        <div class="process-card__rows">${processRows}</div>
        <button type="button" class="process-card__close" data-process-close aria-label="Close process panel">
          <span>Close</span><span class="close-icon" aria-hidden="true"><i></i><i></i></span>
        </button>
      </section>
    </div>
  `),
);

mountChrome({ homeHref, current: "about" });

const processOverlay = required<HTMLElement>(root, "[data-process-overlay]");
let closeTimer = 0;
let returnFocus: HTMLElement | null = null;

const openProcess = () => {
  if (processOverlay.classList.contains("is-open")) return;
  window.clearTimeout(closeTimer);
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setScrollLock(true);
  processOverlay.hidden = false;
  document.body.classList.add("process-open");
  window.requestAnimationFrame(() => {
    processOverlay.classList.add("is-open");
    required<HTMLButtonElement>(processOverlay, ".process-card__close").focus({ preventScroll: true });
  });
};

const closeProcess = () => {
  if (processOverlay.hidden) return;
  processOverlay.classList.remove("is-open");
  document.body.classList.remove("process-open");
  returnFocus?.focus({ preventScroll: true });
  closeTimer = window.setTimeout(() => {
    processOverlay.hidden = true;
    setScrollLock(false);
  }, 800);
};

root.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("[data-open-process]")) openProcess();
  else if (target?.closest("[data-process-close]")) closeProcess();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeProcess();
});

void fontsReady().then(async () => {
  const revealed = pageRevealed();
  signalPageReady();
  await revealed;
  document.body.classList.add("is-ready");
});
