import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter-tight";
import "../styles/base.css";
import "../styles/project.css";

import { site } from "../config";
import { findProject, projects } from "../data/projects";
import { mountChrome } from "../lib/chrome";
import { escapeHtml as e, html, required } from "../lib/dom";
import { openLightbox, type LightboxItem } from "../lib/lightbox";
import { clamp, pad2, wrapIndex } from "../lib/math";
import { fontsReady } from "../lib/motion";
import { placeholderArt } from "../lib/placeholderArt";
import { createSmoothScroller } from "../lib/smoothScroll";
import { pageRevealed, signalPageReady } from "../lib/transition";

/** Width / height of each gallery image; most are browser-window captures. */
const MEDIA_RATIOS = [1.6, 1.6, 1.62, 1.6, 1.25, 1.6, 1.6, 1.6] as const;
/** Share of the gallery scrolled before the big title blurs away. */
const TITLE_FADE_PROGRESS = 0.05;
/** The minimap window never grows past this share of the viewport height. */
const MINIMAP_MAX_HEIGHT = 0.5;

const index = findProject(new URLSearchParams(window.location.search).get("p"));
const project = projects[index] ?? projects[0];
const next = projects[wrapIndex(index + 1, projects.length)] ?? projects[0];
if (!project || !next) throw new Error("No projects configured");
document.title = `${site.name} — ${project.title}`;

const media = MEDIA_RATIOS.map((ratio, slot) => ({
  ratio,
  src: placeholderArt({ seed: (index + 1) * 10 + slot, palette: project.palette, ratio, label: project.title }),
}));
const lightboxItems: LightboxItem[] = media.map((item, slot) => ({
  src: item.src,
  alt: `${project.title} image ${slot + 1}`,
  caption: `${project.title} — ${pad2(slot + 1)} / ${pad2(media.length)}`,
}));

const lines = (values: readonly string[]) => values.map((value) => `<span>${e(value)}</span>`).join("");

const root = required<HTMLElement>(document, "[data-project]");
root.append(
  html(`
  <div class="project__scroll" data-scroll>
    <h1 class="project__title" data-reveal style="--reveal-delay: 120ms; --chars: ${project.title.length}">
      <span class="project__title-text" data-title-text>${e(project.title)}</span>
    </h1>
    <aside class="project__info" data-reveal style="--reveal-delay: 40ms" aria-label="Project details">
      <div class="project__info-body" data-hideable>
        <div class="info__row">
          <span class="info__label">About</span>
          <p class="info__value">${e(project.description)} This paragraph is placeholder copy: the brief, the idea, and what changed for the client.</p>
        </div>
        <div class="info__row info__row--split">
          <span class="info__label">Role</span>
          <p class="info__value">${lines(project.roles)}</p>
          <span class="info__label">Launch</span>
          <p class="info__value">${e(project.date)}</p>
        </div>
        <a class="info__visit" href="https://example.com/" target="_blank" rel="noreferrer">Visit site <span aria-hidden="true">→</span></a>
      </div>
    </aside>
    <div class="project__media">
      ${media
        .map(
          (item, slot) => `
        <figure class="media" data-media="${slot}" style="--ratio: ${item.ratio}; --i: ${slot}">
          <button type="button" class="media__open" aria-label="Open image ${slot + 1} of ${media.length}">
            <img src="${item.src}" alt="" ${slot > 1 ? 'loading="lazy"' : ""} />
          </button>
        </figure>`,
        )
        .join("")}
    </div>
    <section class="project__next" aria-label="Next project">
      <span class="project__marker" data-hide-marker aria-hidden="true"></span>
      <p class="project__next-label">Next project</p>
      <a class="project__next-title" href="/project.html?p=${encodeURIComponent(next.slug)}" data-transition data-transition-label="${e(next.title)}">${e(next.title)}</a>
    </section>
  </div>
  <nav class="minimap" data-reveal style="--reveal-delay: 200ms" aria-label="Gallery overview">
    <div class="minimap__body" data-hideable>
      <div class="minimap__window" data-minimap-window>
        <div class="minimap__strip" data-minimap-strip>
          ${media
            .map(
              (item, slot) => `
          <button type="button" class="minimap__item" data-minimap="${slot}" aria-label="Go to image ${slot + 1}">
            <img src="${item.src}" alt="" />
          </button>`,
            )
            .join("")}
        </div>
        <span class="minimap__frame" data-minimap-frame aria-hidden="true"></span>
      </div>
    </div>
  </nav>
  <p class="project__hint" data-reveal style="--reveal-delay: 260ms"><span data-hideable>Scroll</span></p>
`),
);

mountChrome({ homeHref: "/" });

const scrollArea = required<HTMLElement>(root, "[data-scroll]");
const scroller = createSmoothScroller(scrollArea);
const titleText = required<HTMLElement>(root, "[data-title-text]");
const figures = [...root.querySelectorAll<HTMLElement>("[data-media]")];
const thumbs = [...root.querySelectorAll<HTMLElement>("[data-minimap]")];
const minimapWindow = required<HTMLElement>(root, "[data-minimap-window]");
const strip = required<HTMLElement>(root, "[data-minimap-strip]");
const frame = required<HTMLElement>(root, "[data-minimap-frame]");

/** Gallery image centres in scroll-content coordinates, refreshed on layout changes. */
let centres: number[] = [];
const measure = () => {
  const offset = scrollArea.getBoundingClientRect().top - scrollArea.scrollTop;
  centres = figures.map((figure) => {
    const rect = figure.getBoundingClientRect();
    return rect.top - offset + rect.height / 2;
  });
};

/** Fractional index of the gallery image at the viewport centre. */
const galleryPosition = (): number => {
  const centre = scrollArea.scrollTop + scrollArea.clientHeight / 2;
  for (let slot = 0; slot < centres.length - 1; slot += 1) {
    const here = centres[slot] ?? 0;
    const there = centres[slot + 1] ?? here;
    if (centre < there) return slot + clamp((centre - here) / Math.max(1, there - here), 0, 1);
  }
  return Math.max(0, centres.length - 1);
};

const updateMinimap = () => {
  const first = thumbs[0];
  const second = thumbs[1];
  if (!first) return;
  const pitch = second ? second.offsetTop - first.offsetTop : first.offsetHeight;
  const position = galleryPosition();
  const frameTop = position * pitch;
  const stripHeight = strip.scrollHeight;
  const windowHeight = Math.min(stripHeight, window.innerHeight * MINIMAP_MAX_HEIGHT);
  const shift = clamp(frameTop + first.offsetHeight / 2 - windowHeight / 2, 0, Math.max(0, stripHeight - windowHeight));
  minimapWindow.style.height = `${windowHeight}px`;
  strip.style.transform = `translate3d(0, ${(-shift).toFixed(1)}px, 0)`;
  frame.style.transform = `translate3d(0, ${(frameTop - shift).toFixed(1)}px, 0)`;
  const current = Math.round(position);
  thumbs.forEach((thumb, slot) => thumb.classList.toggle("is-current", slot === current));
};

const onScroll = () => {
  const max = Math.max(1, scrollArea.scrollHeight - scrollArea.clientHeight);
  titleText.classList.toggle("is-faded", scrollArea.scrollTop / max >= TITLE_FADE_PROGRESS);
  updateMinimap();
};
scrollArea.addEventListener("scroll", onScroll, { passive: true });
new ResizeObserver(() => {
  measure();
  onScroll();
}).observe(scrollArea);

// The side columns step aside once the next-project section reaches the middle of the screen.
const hideables = [...document.querySelectorAll<HTMLElement>("[data-hideable]")];
new IntersectionObserver(
  (entries) => {
    const reached = entries.some((entry) => entry.isIntersecting);
    for (const element of hideables) element.classList.toggle("is-hidden", reached);
  },
  { root: scrollArea, threshold: 0 },
).observe(required<HTMLElement>(root, "[data-hide-marker]"));

root.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const figure = target?.closest<HTMLElement>("[data-media]");
  if (figure) {
    openLightbox(lightboxItems, Number(figure.dataset.media));
    return;
  }
  const thumb = target?.closest<HTMLElement>("[data-minimap]");
  if (thumb) {
    const centre = centres[Number(thumb.dataset.minimap)] ?? 0;
    scroller.scrollTo(centre - scrollArea.clientHeight / 2);
  }
});

void fontsReady().then(async () => {
  measure();
  onScroll();
  const revealed = pageRevealed();
  signalPageReady();
  await revealed;
  document.body.classList.add("is-ready");
});
