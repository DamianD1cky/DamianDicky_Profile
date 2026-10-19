const FRAME_SECONDS = 1 / 60;
/** Share of the queued pages released into the target per 60 Hz frame. */
const QUEUE_RELEASE = 0.075;
/** Share of the remaining distance the ribbon covers per 60 Hz frame. */
const FOLLOW = 0.047;
const SPEED_DECAY = 0.829;
const QUEUE_SETTLE_MS = 150;
const SCRUB_SETTLE_MS = 240;
const FLICK_SPEED = 1.5;

/**
 * Scroll position of the ribbon, in pages. Whole-page moves are queued and
 * released gradually, the visible position chases the target, and `speed`
 * records recent movement so the pages can curl while they travel.
 */
export class RibbonScroll {
    current = 0;
    target = 0;
    speed = 0;
    private queued = 0;
    private settleAt = 0;
    private dragging = false;

    /** Where the ribbon will rest once queued moves are released. */
    get destination(): number {
        return this.target + this.queued;
    }

    get idle(): boolean {
        return (
            this.queued === 0 &&
            this.settleAt === 0 &&
            !this.dragging &&
            this.current === this.target &&
            Math.abs(this.speed) < 1e-4
        );
    }

    /** Places the ribbon at an exact page without animating through earlier pages. */
    jumpTo(page: number): void {
        this.current = page;
        this.target = page;
        this.speed = 0;
        this.queued = 0;
        this.settleAt = 0;
        this.dragging = false;
    }

    /** Mouse wheel notches, keys and clicks move by whole pages. */
    moveBy(pages: number): void {
        if (pages === 0) return;
        this.queued += pages;
        this.settleAt = 0;
    }

    /** Trackpad input moves the target directly and snaps once the gesture pauses. */
    scrub(pages: number): void {
        this.target += pages;
        this.speed += pages;
        this.settleAt = performance.now() + SCRUB_SETTLE_MS;
    }

    beginDrag(): void {
        this.dragging = true;
        this.settleAt = 0;
    }

    drag(pages: number): void {
        this.target += pages;
        this.speed += pages;
    }

    endDrag(pagesPerSecond: number): void {
        this.dragging = false;
        const flick =
            Math.abs(pagesPerSecond) > FLICK_SPEED
                ? Math.sign(pagesPerSecond) * 0.5
                : 0;
        this.target = Math.round(this.target + flick);
    }

    update(dtSeconds: number, now: number): void {
        const frames = Math.min(4, dtSeconds / FRAME_SECONDS);
        if (this.queued !== 0) {
            let released = this.queued * (1 - (1 - QUEUE_RELEASE) ** frames);
            if (Math.abs(this.queued - released) < 0.001)
                released = this.queued;
            this.queued -= released;
            this.target += released;
            this.speed += released;
            if (this.queued === 0) this.settleAt = now + QUEUE_SETTLE_MS;
        }
        if (this.settleAt !== 0 && now >= this.settleAt && !this.dragging) {
            this.target = Math.round(this.target);
            this.settleAt = 0;
        }
        this.current +=
            (this.target - this.current) * (1 - (1 - FOLLOW) ** frames);
        if (
            this.queued === 0 &&
            this.settleAt === 0 &&
            !this.dragging &&
            Math.abs(this.target - this.current) < 5e-4
        ) {
            this.current = this.target;
        }
        this.speed *= SPEED_DECAY ** frames;
        if (Math.abs(this.speed) < 1e-5) this.speed = 0;
    }
}
