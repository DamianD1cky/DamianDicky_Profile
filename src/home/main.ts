import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter-tight";
import "../styles/base.css";
import "../styles/home.css";

import { site } from "../config";
import { findProject, projects } from "../data/projects";
import { blurSwap } from "../lib/blurSwap";
import { mountChrome } from "../lib/chrome";
import { escapeHtml as e, html, required } from "../lib/dom";
import { openLightbox, type LightboxItem } from "../lib/lightbox";
import { clamp, pad2, wrapIndex } from "../lib/math";
import { fontsReady, prefersReducedMotion, wait } from "../lib/motion";
import { placeholderArt } from "../lib/placeholderArt";
import { isScrollLocked } from "../lib/smoothScroll";
import { navigateWithTransition, pageRevealed, signalPageReady } from "../lib/transition";
import { playNameIntro } from "./intro";
import type { RibbonScene } from "./ribbonScene";

// three.js stays out of the first chunk and loads while fonts settle.
const ribbonModule = import("./ribbonScene");
const LIST_COPIES = 3;
const initialProject = findProject(
    new URLSearchParams(window.location.search).get("work"),
);
const projectHref = (slug: string) =>
    `/project.html?p=${encodeURIComponent(slug)}`;

const syncProjectUrl = (index: number) => {
    const project = projects[index];
    if (!project) return;
    const url = new URL(window.location.href);
    if (index === 0) url.searchParams.delete("work");
    else url.searchParams.set("work", project.slug);
    const href = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== current) window.history.replaceState(window.history.state, "", href);
};

mountChrome({ homeHref: "/" });

const stage = required<HTMLElement>(document, "[data-stage]");
stage.append(
    html(`
  <div class="ribbon" data-ribbon></div>
  <section class="meta" aria-live="polite" data-reveal style="--reveal-delay: 240ms">
    <div class="meta__group meta__group--role">
      <span class="meta__label">Role</span><p class="meta__value" data-meta-roles></p>
    </div>
    <div class="meta__group meta__group--launch">
      <span class="meta__label">Launch</span>
      <div class="meta__stack">
        <p class="meta__value" data-meta-date></p>
        <a class="meta__link" href="#" data-meta-link data-transition>View project <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </section>
  <div class="counter" data-reveal style="--reveal-delay: 300ms">
    <span class="counter__label">Selected work</span>
    <span class="counter__value" data-counter>01</span>
    <span class="counter__total">/${pad2(projects.length)}</span>
  </div>
  <div class="list" data-reveal style="--reveal-delay: 340ms"><ol class="list__track" data-list></ol></div>
  <div class="swatches" data-swatches data-reveal style="--reveal-delay: 380ms" aria-hidden="true"><i></i><i></i><i></i></div>
  <p class="hint" data-reveal style="--reveal-delay: 420ms">Scroll</p>
  <button type="button" class="reel" data-reel data-reveal style="--reveal-delay: 460ms">Showreel <span aria-hidden="true">▶</span></button>
`),
);

const covers = projects.map((project, index) =>
    placeholderArt({
        seed: index + 1,
        palette: project.palette,
        ratio: project.ratio,
        label: project.title,
    }),
);
const lightboxItems: LightboxItem[] = projects.map((project, index) => ({
    src: covers[index] ?? "",
    alt: `${project.title} cover`,
    caption: `${pad2(index + 1)} — ${project.title}`,
}));

// The list is rendered three times so it can loop without a visible jump.
const track = required<HTMLOListElement>(stage, "[data-list]");
track.append(
    html(
        Array.from({ length: LIST_COPIES }, (_, copy) =>
            projects
                .map(
                    (project, index) => `
      <li class="list__item" data-list-index="${index}" ${copy === 1 ? "" : 'aria-hidden="true"'}>
        <p class="list__category">${e(project.category)}</p>
        <a class="list__title" href="${projectHref(project.slug)}" data-transition data-transition-label="${e(project.title)}" tabindex="-1">${e(project.title)}</a>
        <span class="list__dash" aria-hidden="true"></span>
        <p class="list__description">${e(project.description)}</p>
      </li>`,
                )
                .join(""),
        ).join(""),
    ),
);
const listItems = [...track.querySelectorAll<HTMLLIElement>(".list__item")];
const list = required<HTMLElement>(stage, ".list");
let itemHeight = 0;
let listHeight = 0;
const measureList = () => {
    itemHeight = listItems[0]?.offsetHeight ?? 0;
    listHeight = list.clientHeight;
};
window.addEventListener("resize", measureList);

let lastListPosition = Number.NaN;
const updateList = (position: number) => {
    const looped = wrapIndex(position, projects.length) + projects.length;
    if (looped === lastListPosition || !itemHeight) return;
    lastListPosition = looped;
    track.style.transform = `translate3d(0, ${(-looped * itemHeight + (listHeight - itemHeight) / 2).toFixed(1)}px, 0)`;
    listItems.forEach((item, slot) => {
        const distance = Math.abs(slot - looped);
        if (distance > 6) return;
        item.style.setProperty("--focus", clamp(1 - distance, 0, 1).toFixed(3));
    });
};

const roles = required<HTMLElement>(stage, "[data-meta-roles]");
const date = required<HTMLElement>(stage, "[data-meta-date]");
const link = required<HTMLAnchorElement>(stage, "[data-meta-link]");
const counter = required<HTMLElement>(stage, "[data-counter]");
const swatches = [...stage.querySelectorAll<HTMLElement>("[data-swatches] i")];

const lines = (values: readonly string[]) =>
    values.map((value) => {
        const line = document.createElement("span");
        line.textContent = value;
        return line;
    });

const render = (index: number, animate: boolean) => {
    const project = projects[index];
    if (!project) return;
    const apply = (element: HTMLElement, delay: number, update: () => void) => {
        if (!animate) update();
        else window.setTimeout(() => blurSwap(element, update), delay);
    };
    apply(counter, 0, () => {
        counter.textContent = pad2(index + 1);
    });
    apply(roles, 30, () => roles.replaceChildren(...lines(project.roles)));
    apply(date, 60, () => {
        date.textContent = project.date;
    });
    link.href = projectHref(project.slug);
    link.dataset.transitionLabel = project.title;
    link.setAttribute("aria-label", `View project ${project.title}`);
    swatches.forEach((swatch, slot) => {
        swatch.style.backgroundColor = project.palette[slot] ?? "transparent";
    });
    listItems.forEach((item) => {
        const isActive = Number(item.dataset.listIndex) === index;
        item.classList.toggle("is-active", isActive);
        item.querySelector("a")?.setAttribute(
            "tabindex",
            isActive && !item.hasAttribute("aria-hidden") ? "0" : "-1",
        );
    });
};

let ribbon: RibbonScene | null = null;

// Clicking a passive list entry brings it to the centre instead of opening it.
track.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLElement>(".list__item");
    if (!item || !ribbon) return;
    const index = Number(item.dataset.listIndex);
    if (index === ribbon.index) return;
    event.preventDefault();
    ribbon.goTo(index);
});

required<HTMLButtonElement>(stage, "[data-reel]").addEventListener(
    "click",
    () => openLightbox(lightboxItems, ribbon?.index ?? 0),
);

async function start(): Promise<void> {
    syncProjectUrl(initialProject);
    render(initialProject, false);
    measureList();
    const [{ RibbonScene, bindRibbonInput }] = await Promise.all([
        ribbonModule,
        fontsReady(),
    ]);
    ribbon = await RibbonScene.create({
        container: required<HTMLElement>(stage, "[data-ribbon]"),
        projects,
        covers,
        initialIndex: initialProject,
        onChange: (index) => {
            syncProjectUrl(index);
            render(index, true);
        },
        onActivate: (index) => {
            const project = projects[index];
            if (project) navigateWithTransition(projectHref(project.slug), project.title);
        },
        onFrame: updateList,
    });
    bindRibbonInput(ribbon.scroll, isScrollLocked);
    measureList();
    const revealed = pageRevealed();
    signalPageReady();
    await revealed;

    const intro = required<HTMLElement>(document, "[data-intro]");
    if (document.documentElement.dataset.incoming === "true") intro.remove();
    else
        await playNameIntro(
            intro,
            required<HTMLElement>(intro, "[data-intro-name]"),
            site.introName,
        );

    ribbon.playIntro();
    await wait(prefersReducedMotion() ? 0 : 900);
    document.body.classList.add("is-ready");
}

void start();
