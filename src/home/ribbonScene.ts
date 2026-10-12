import {
    CanvasTexture,
    DoubleSide,
    DynamicDrawUsage,
    Group,
    InstancedBufferAttribute,
    InstancedMesh,
    LinearFilter,
    Matrix4,
    OrthographicCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Vector3,
    WebGLRenderer,
} from "three";
import type { Palette, Project } from "../data/projects";
import { clamp, wrapIndex } from "../lib/math";
import { prefersReducedMotion } from "../lib/motion";
import {
    configFor,
    pageCountFor,
    pageMatrix,
    pageState,
    smoothstep,
    STAGE,
    wrapCentered,
    type IntroState,
    type PageState,
    type RibbonConfig,
} from "./ribbonLayout";
import { RibbonScroll } from "./ribbonScroll";
import { fragmentShader, vertexShader } from "./ribbonShaders";

export { bindRibbonInput } from "./ribbonInput";

export interface RibbonOptions {
    readonly container: HTMLElement;
    readonly projects: readonly Project[];
    readonly covers: readonly string[];
    readonly onChange: (index: number) => void;
    readonly onActivate: (index: number) => void;
    readonly onFrame?: (position: number) => void;
}

const INTRO_MS = 2400;
const CELL_ASPECT = 4 / 3;
const HOVER_LIFT = 0.25;
const PARALLAX_TURN = 0.05;
const PAGE_SEGMENTS = 32;
const PICK_RANGE = 14;
const CORNERS = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
] as const;

interface ScreenPoint {
    x: number;
    y: number;
}

interface Gl {
    readonly renderer: WebGLRenderer;
    readonly scene: Scene;
    readonly camera: OrthographicCamera;
    readonly tilt: Group;
    readonly mesh: InstancedMesh<PlaneGeometry, ShaderMaterial>;
    readonly cells: Float32Array;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutQuad = (t: number) => 1 - (1 - t) ** 2;

/** The closed magazine spreads out first, then the centre gap opens and the focused page turns. */
function introState(elapsedMs: number | null): IntroState {
    if (elapsedMs === null) return { spread: 0, settle: 0 };
    const t = clamp(elapsedMs / INTRO_MS, 0, 1);
    return {
        spread: easeOutCubic(clamp(t / 0.55, 0, 1)),
        settle: easeOutQuad(clamp((t - 0.4) / 0.6, 0, 1)),
    };
}

export class RibbonScene {
    readonly scroll = new RibbonScroll();
    private readonly projectCount: number;
    private readonly pageCount: number;
    private readonly reduce = prefersReducedMotion();
    private readonly matrices: Matrix4[];
    private readonly states: PageState[];
    private readonly lifts: Float32Array;
    private readonly fallback: HTMLImageElement | null = null;
    private config = configFor(window.innerWidth);
    private introStart: number | null = null;
    private active = 0;
    private hovered = -1;
    private pointerX = 0;
    private tiltY = 0;
    private lastTime = 0;
    private dirty = true;

    /** Builds the WebGL ribbon, or a static cover when WebGL is unavailable. */
    static async create(options: RibbonOptions): Promise<RibbonScene> {
        let renderer: WebGLRenderer | null = null;
        try {
            renderer = new WebGLRenderer({ antialias: true, alpha: true });
        } catch {
            renderer = null;
        }
        const atlas = renderer
            ? await buildAtlas(
                  options.covers,
                  options.projects.map((p) => p.palette),
              )
            : null;
        return new RibbonScene(
            options,
            renderer && atlas ? createGl(renderer, atlas, options) : null,
        );
    }

    private constructor(
        private readonly options: RibbonOptions,
        private readonly gl: Gl | null,
    ) {
        this.projectCount = options.projects.length;
        this.pageCount = pageCountFor(this.projectCount);
        this.matrices = Array.from(
            { length: this.pageCount },
            () => new Matrix4(),
        );
        this.states = Array.from({ length: this.pageCount }, () => ({
            offset: 0,
            slot: 0,
            focus: 0,
        }));
        this.lifts = new Float32Array(this.pageCount);

        const { container } = options;
        if (this.gl) {
            this.gl.renderer.domElement.setAttribute("aria-hidden", "true");
            container.append(this.gl.renderer.domElement);
            this.applyConfig(this.config);
        } else {
            this.fallback = document.createElement("img");
            this.fallback.className = "ribbon__fallback";
            this.fallback.alt = "";
            this.fallback.src = options.covers[0] ?? "";
            container.append(this.fallback);
        }

        window.addEventListener("pointermove", (event) => {
            this.pointerX =
                (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        });
        container.addEventListener("pointermove", (event) =>
            this.hover(this.pick(event.clientX, event.clientY)),
        );
        container.addEventListener("pointerleave", () => this.hover(-1));
        container.addEventListener("click", (event) =>
            this.select(event.clientX, event.clientY),
        );
        new ResizeObserver(() => this.resize()).observe(container);
        this.resize();
        window.requestAnimationFrame(this.tick);
    }

    /** Project currently in the centre. */
    get index(): number {
        return this.active;
    }

    goTo(project: number): void {
        const destination = Math.round(this.scroll.destination);
        const delta = wrapCentered(
            project - wrapIndex(destination, this.projectCount),
            this.projectCount,
        );
        this.scroll.moveBy(Math.round(delta));
    }

    playIntro(): void {
        this.introStart = this.reduce ? -INTRO_MS : performance.now();
    }

    private projectOf(page: number): number {
        return wrapIndex(page, this.projectCount);
    }

    private tick = (time: number): void => {
        window.requestAnimationFrame(this.tick);
        const dt = this.lastTime
            ? Math.min(0.1, (time - this.lastTime) / 1000)
            : 1 / 60;
        this.lastTime = time;
        const frames = dt * 60;

        this.scroll.update(dt, time);
        const introRunning =
            this.introStart !== null && time - this.introStart < INTRO_MS;

        const tiltGoal =
            this.config.parallax && !this.reduce
                ? this.pointerX * PARALLAX_TURN
                : 0;
        this.tiltY += (tiltGoal - this.tiltY) * (1 - 0.95 ** frames);
        if (Math.abs(tiltGoal - this.tiltY) < 1e-5) this.tiltY = tiltGoal;

        let lifting = false;
        for (let page = 0; page < this.pageCount; page += 1) {
            const goal = page === this.hovered ? 1 : 0;
            const lift = this.lifts[page] ?? 0;
            const next = lift + (goal - lift) * (1 - 0.93 ** frames);
            this.lifts[page] = Math.abs(goal - next) < 1e-3 ? goal : next;
            lifting ||= this.lifts[page] !== goal;
        }

        const active = this.projectOf(Math.round(this.scroll.current));
        if (active !== this.active) {
            this.active = active;
            if (this.fallback)
                this.fallback.src = this.options.covers[active] ?? "";
            this.options.onChange(active);
        }
        this.options.onFrame?.(this.scroll.current);

        const changed =
            this.dirty ||
            !this.scroll.idle ||
            introRunning ||
            lifting ||
            this.tiltY !== tiltGoal;
        if (!changed || !this.gl) return;
        this.dirty = false;
        this.layout(
            introState(
                this.introStart === null ? null : time - this.introStart,
            ),
        );
        this.gl.tilt.rotation.y = this.tiltY;
        this.gl.renderer.render(this.gl.scene, this.gl.camera);
    };

    private layout(intro: IntroState): void {
        const gl = this.gl;
        if (!gl) return;
        for (let page = 0; page < this.pageCount; page += 1) {
            const state = pageState(
                page,
                this.scroll.current,
                this.pageCount,
                intro,
            );
            this.states[page] = state;
            const lift =
                (this.lifts[page] ?? 0) *
                HOVER_LIFT *
                smoothstep(0.05, 0.4, 1 - state.focus);
            const matrix = this.matrices[page];
            if (!matrix) continue;
            gl.mesh.setMatrixAt(
                page,
                pageMatrix(matrix, state, this.config, lift),
            );
        }
        gl.mesh.instanceMatrix.needsUpdate = true;
        const curl = gl.mesh.material.uniforms.uCurl;
        if (curl)
            curl.value = this.reduce
                ? 0
                : clamp(this.scroll.speed * 2, -2, 2) * this.config.scrollCurve;
    }

    private resize(): void {
        const { container } = this.options;
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        const config = configFor(window.innerWidth);
        if (config !== this.config) this.applyConfig(config);
        const gl = this.gl;
        if (!gl) return;
        gl.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        gl.renderer.setSize(width, height, false);
        const half = STAGE.frustumHeight / 2;
        const aspect = width / height;
        gl.camera.left = -half * aspect;
        gl.camera.right = half * aspect;
        gl.camera.top = half;
        gl.camera.bottom = -half;
        gl.camera.updateProjectionMatrix();
        this.dirty = true;
    }

    private applyConfig(config: RibbonConfig): void {
        this.config = config;
        const gl = this.gl;
        if (!gl) return;
        const geometry = new PlaneGeometry(
            config.pageWidth,
            config.pageHeight,
            1,
            PAGE_SEGMENTS,
        );
        geometry.setAttribute(
            "aCell",
            new InstancedBufferAttribute(gl.cells, 4),
        );
        gl.mesh.geometry.dispose();
        gl.mesh.geometry = geometry;
        const { uniforms } = gl.mesh.material;
        if (uniforms.uPageHeight)
            uniforms.uPageHeight.value = config.pageHeight;
        if (uniforms.uPageAspect)
            uniforms.uPageAspect.value = config.pageWidth / config.pageHeight;
        gl.mesh.position.set(...config.meshPosition);
        this.dirty = true;
    }

    private hover(page: number): void {
        if (page === this.hovered) return;
        this.hovered = page;
        const focused = page >= 0 && (this.states[page]?.focus ?? 0) > 0.5;
        this.options.container.style.cursor =
            page < 0 ? "" : focused ? "zoom-in" : "pointer";
    }

    private select(clientX: number, clientY: number): void {
        if (this.fallback) {
            this.options.onActivate(this.active);
            return;
        }
        const page = this.pick(clientX, clientY);
        const state = this.states[page];
        if (page < 0 || !state) return;
        if (state.focus > 0.5) {
            this.options.onActivate(this.projectOf(page));
            return;
        }
        this.scroll.moveBy(
            Math.round(
                -wrapCentered(this.scroll.destination - page, this.pageCount),
            ),
        );
    }

    /** Front-most page under the pointer, found by projecting each page's corners like the GPU does. */
    private pick(clientX: number, clientY: number): number {
        const gl = this.gl;
        if (!gl) return -1;
        const rect = gl.renderer.domElement.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const halfWidth = this.config.pageWidth / 2;
        const halfHeight = this.config.pageHeight / 2;
        let best = -1;
        let bestDepth = Number.POSITIVE_INFINITY;
        for (let page = 0; page < this.pageCount; page += 1) {
            const state = this.states[page];
            const matrix = this.matrices[page];
            if (!state || !matrix || Math.abs(state.offset) > PICK_RANGE)
                continue;
            world.multiplyMatrices(gl.mesh.matrixWorld, matrix);
            let depth = 0;
            const quad = CORNERS.map(([cx, cy]) => {
                corner
                    .set(cx * halfWidth, cy * halfHeight, 0)
                    .applyMatrix4(world)
                    .project(gl.camera);
                depth += corner.z / 4;
                return {
                    x: ((corner.x + 1) / 2) * rect.width,
                    y: ((1 - corner.y) / 2) * rect.height,
                };
            });
            if (depth < bestDepth && insideConvexQuad(x, y, quad)) {
                best = page;
                bestDepth = depth;
            }
        }
        return best;
    }
}

const world = new Matrix4();
const corner = new Vector3();

function insideConvexQuad(
    x: number,
    y: number,
    quad: readonly ScreenPoint[],
): boolean {
    let side = 0;
    for (let i = 0; i < quad.length; i += 1) {
        const a = quad[i];
        const b = quad[(i + 1) % quad.length];
        if (!a || !b) return false;
        const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
        if (cross === 0) continue;
        if (side === 0) side = Math.sign(cross);
        else if (Math.sign(cross) !== side) return false;
    }
    return true;
}

function createGl(
    renderer: WebGLRenderer,
    atlas: Atlas,
    options: RibbonOptions,
): Gl {
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.copy(STAGE.cameraPosition);
    camera.lookAt(STAGE.cameraTarget);

    const texture = new CanvasTexture(atlas.canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;

    const projectCount = options.projects.length;
    const pageCount = pageCountFor(projectCount);
    const cells = new Float32Array(pageCount * 4);
    for (let page = 0; page < pageCount; page += 1) {
        const project = wrapIndex(page, projectCount);
        cells.set(atlas.cells.subarray(project * 4, project * 4 + 4), page * 4);
    }

    const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: DoubleSide,
        uniforms: {
            uAtlas: { value: texture },
            uCurl: { value: 0 },
            uPageHeight: { value: 1 },
            uPageAspect: { value: 1 },
            uCellAspect: { value: CELL_ASPECT },
        },
    });
    const mesh = new InstancedMesh(
        new PlaneGeometry(1, 1),
        material,
        pageCount,
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.rotation.set(...STAGE.meshRotation);

    const tilt = new Group();
    tilt.add(mesh);
    scene.add(tilt);
    return { renderer, scene, camera, tilt, mesh, cells };
}

interface Atlas {
    readonly canvas: HTMLCanvasElement;
    readonly cells: Float32Array;
}

/** Draws every cover into one texture so all pages render in a single instanced draw call. */
async function buildAtlas(
    covers: readonly string[],
    palettes: readonly Palette[],
): Promise<Atlas> {
    const atlas = await paintAtlas(covers, palettes, true);
    return isTainted(atlas.canvas)
        ? paintAtlas(covers, palettes, false)
        : atlas;
}

async function paintAtlas(
    covers: readonly string[],
    palettes: readonly Palette[],
    useImages: boolean,
): Promise<Atlas> {
    const cellWidth = (window.devicePixelRatio || 1) >= 1.5 ? 768 : 512;
    const cellHeight = Math.round(cellWidth / CELL_ASPECT);
    const columns = Math.ceil(Math.sqrt(covers.length));
    const rows = Math.ceil(covers.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * cellWidth;
    canvas.height = rows * cellHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is unavailable");
    const cells = new Float32Array(covers.length * 4);

    await Promise.all(
        covers.map(async (src, index) => {
            const x = (index % columns) * cellWidth;
            const y = Math.floor(index / columns) * cellHeight;
            let drawn = false;
            if (useImages) {
                try {
                    const image = new Image();
                    image.src = src;
                    await image.decode();
                    drawCover(context, image, x, y, cellWidth, cellHeight);
                    drawn = true;
                } catch {
                    drawn = false;
                }
            }
            if (!drawn) {
                context.fillStyle = palettes[index]?.[0] ?? "#cccccc";
                context.fillRect(x, y, cellWidth, cellHeight);
            }
            // Canvas textures are flipped, so v runs bottom-up; the half-texel inset keeps filtering inside the cell.
            cells.set(
                [
                    (x + 0.5) / canvas.width,
                    1 - (y + cellHeight - 0.5) / canvas.height,
                    (x + cellWidth - 0.5) / canvas.width,
                    1 - (y + 0.5) / canvas.height,
                ],
                index * 4,
            );
        }),
    );
    return { canvas, cells };
}

function drawCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
): void {
    const scale = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight,
    );
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    context.drawImage(
        image,
        (image.naturalWidth - sourceWidth) / 2,
        (image.naturalHeight - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height,
    );
}

/** A cross-origin image would make the GPU upload throw, so detect it up front. */
function isTainted(canvas: HTMLCanvasElement): boolean {
    try {
        canvas.getContext("2d")?.getImageData(0, 0, 1, 1);
        return false;
    } catch {
        return true;
    }
}
