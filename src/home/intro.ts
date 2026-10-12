import { nextFrame, prefersReducedMotion, wait } from "../lib/motion";

/**
 * Name reveal: letters rise into masked lines, hold, rise out, then the
 * overlay wipes upward to uncover the ribbon.
 */
export async function playNameIntro(overlay: HTMLElement, name: HTMLElement, lines: readonly string[]): Promise<void> {
  let order = 0;
  name.replaceChildren(
    ...lines.map((line) => {
      const row = document.createElement("span");
      row.className = "intro__line";
      for (const char of line) {
        const glyph = document.createElement("span");
        glyph.className = "intro__char";
        glyph.textContent = char;
        glyph.style.setProperty("--i", String(order));
        order += 1;
        row.append(glyph);
      }
      return row;
    }),
  );

  if (prefersReducedMotion()) {
    overlay.remove();
    return;
  }

  await nextFrame();
  await nextFrame();
  overlay.classList.add("is-in");
  await wait(700 + order * 45);
  overlay.classList.add("is-out");
  await wait(950);
  overlay.remove();
}
