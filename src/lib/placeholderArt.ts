import type { Palette } from "../data/projects";
import { escapeHtml } from "./dom";
import { mulberry32, pad2 } from "./math";

export interface ArtOptions {
    readonly seed: number;
    readonly palette: Palette;
    readonly ratio: number;
    readonly label: string;
}

const WIDTH = 1200;

/**
 * Abstract, seeded SVG compositions used instead of real project imagery.
 * Returned as a data URL so the demo ships without image files.
 */
export function placeholderArt({
    seed,
    palette,
    ratio,
    label,
}: ArtOptions): string {
    const random = mulberry32(seed * 7919 + 17);
    const width = WIDTH;
    const height = Math.round(WIDTH / ratio);
    const [base, ink, accent] = palette;
    const pick = <T>(values: readonly T[]): T =>
        values[Math.floor(random() * values.length)] as T;
    const between = (min: number, max: number) => min + random() * (max - min);

    const compositions = [orbits, bands, grid, arches, numeral];
    const compose = compositions[seed % compositions.length] ?? orbits;
    const body = compose();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <radialGradient id="light" cx="${between(0.2, 0.8)}" cy="${between(0.15, 0.6)}" r="0.9">
        <stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="${base}"/>
    ${body}
    <rect width="100%" height="100%" fill="url(#light)"/>
    <rect width="100%" height="100%" filter="url(#grain)" opacity="0.16"/>
    <text x="36" y="${height - 34}" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="2" fill="${ink}" opacity="0.7">${escapeHtml(label.toUpperCase())}</text>
    <text x="${width - 36}" y="${height - 34}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="2" fill="${ink}" opacity="0.7">PLACEHOLDER ${pad2((seed % 97) + 1)}</text>
  </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    function orbits(): string {
        const cx = between(0.35, 0.65) * width;
        const cy = between(0.35, 0.6) * height;
        const radius = between(0.25, 0.36) * height;
        const rings = Array.from({ length: 6 }, (_, ring) => {
            const r = radius * (1.25 + ring * 0.22);
            return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ink}" stroke-opacity="${0.5 - ring * 0.07}" stroke-width="2"/>`;
        }).join("");
        return `${rings}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${ink}"/>
      <circle cx="${cx + radius * between(0.4, 0.9)}" cy="${cy - radius * between(0.2, 0.7)}" r="${radius * between(0.3, 0.5)}" fill="${accent}"/>`;
    }

    function bands(): string {
        let x = -height;
        const stripes: string[] = [];
        while (x < width + height) {
            const w = between(40, 160);
            stripes.push(
                `<polygon points="${x},0 ${x + w},0 ${x + w - height * 0.6},${height} ${x - height * 0.6},${height}" fill="${pick([ink, accent, base])}" opacity="${between(0.75, 1)}"/>`,
            );
            x += w + between(10, 60);
        }
        return stripes.join("");
    }

    function grid(): string {
        const step = between(36, 60);
        const dots: string[] = [];
        for (let y = step; y < height; y += step) {
            for (let x = step; x < width; x += step) {
                dots.push(
                    `<circle cx="${x}" cy="${y}" r="${between(2, 5)}" fill="${ink}" opacity="0.55"/>`,
                );
            }
        }
        const bw = between(0.3, 0.5) * width;
        const bh = between(0.45, 0.7) * height;
        return `${dots.join("")}<rect x="${between(0.1, 0.5) * width}" y="${between(0.1, 0.3) * height}" width="${bw}" height="${bh}" fill="${accent}"/>
      <rect x="${between(0.05, 0.6) * width}" y="${between(0.4, 0.6) * height}" width="${bw * 0.6}" height="${bh * 0.5}" fill="${ink}"/>`;
    }

    function arches(): string {
        const count = 3 + Math.floor(random() * 3);
        const gap = width / (count + 1);
        const archWidth = gap * 0.72;
        return Array.from({ length: count }, (_, i) => {
            const x = gap * (i + 1) - archWidth / 2;
            const top = between(0.18, 0.42) * height;
            const r = archWidth / 2;
            const fill = i % 2 === 0 ? ink : accent;
            return `<path d="M${x},${height} V${top + r} A${r},${r} 0 0 1 ${x + archWidth},${top + r} V${height} Z" fill="${fill}"/>`;
        }).join("");
    }

    function numeral(): string {
        const glyph = pad2((seed % 19) + 1);
        return `<rect x="0" y="${height * 0.62}" width="${width}" height="${height * 0.38}" fill="${accent}"/>
      <text x="${width * 0.06}" y="${height * 0.86}" font-family="Georgia, serif" font-size="${height * 0.9}" fill="${ink}" letter-spacing="-20">${glyph}</text>
      <circle cx="${width * 0.82}" cy="${height * 0.28}" r="${height * 0.14}" fill="none" stroke="${ink}" stroke-width="10"/>`;
    }
}
