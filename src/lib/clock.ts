import { site } from "../config";

/** Renders "CITY, HH:MM" for the configured time zone and keeps it on the minute. */
export function startClock(targets: readonly HTMLElement[]): void {
    const format = new Intl.DateTimeFormat("en-GB", {
        timeZone: site.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });

    const render = () => {
        const parts = format.formatToParts(new Date());
        const hour = parts.find((part) => part.type === "hour")?.value ?? "--";
        const minute =
            parts.find((part) => part.type === "minute")?.value ?? "--";
        for (const target of targets) {
            const colon = document.createElement("span");
            colon.className = "clock__colon";
            colon.textContent = ":";
            target.replaceChildren(
                `${site.city.toUpperCase()}, ${hour}`,
                colon,
                minute,
            );
        }
    };

    render();
    const untilNextMinute = 60_000 - (Date.now() % 60_000) + 50;
    window.setTimeout(() => {
        render();
        window.setInterval(render, 60_000);
    }, untilNextMinute);
}
