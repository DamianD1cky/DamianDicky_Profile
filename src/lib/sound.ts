import { blurSwap } from "./blurSwap";

const PEAK_GAIN = 0.2;

/** A soft synthesized pad, so the demo needs no audio files. Starts muted. */
class AmbientPad {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    playing = false;

    private build(): { context: AudioContext; master: GainNode } {
        if (this.context && this.master)
            return { context: this.context, master: this.master };
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0;

        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 820;
        filter.Q.value = 0.6;

        const lfo = context.createOscillator();
        const lfoDepth = context.createGain();
        lfo.frequency.value = 0.06;
        lfoDepth.gain.value = 420;
        lfo.connect(lfoDepth).connect(filter.frequency);
        lfo.start();

        // D, A, E, F#: an open, unresolved chord that loops without fatigue.
        const voices: readonly [number, OscillatorType, number][] = [
            [146.83, "sine", 0.16],
            [220.0, "triangle", 0.06],
            [329.63, "triangle", 0.05],
            [369.99, "sine", 0.05],
        ];
        for (const [frequency, type, level] of voices) {
            for (const detune of [-7, 7]) {
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = type;
                oscillator.frequency.value = frequency;
                oscillator.detune.value = detune;
                gain.gain.value = level;
                oscillator.connect(gain).connect(filter);
                oscillator.start();
            }
        }

        filter.connect(master).connect(context.destination);
        this.context = context;
        this.master = master;
        return { context, master };
    }

    async set(playing: boolean): Promise<void> {
        const { context, master } = this.build();
        this.playing = playing;
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        if (playing) {
            await context.resume();
            master.gain.setTargetAtTime(PEAK_GAIN, now, 0.6);
        } else {
            master.gain.setTargetAtTime(0, now, 0.25);
            window.setTimeout(() => {
                if (!this.playing) void context.suspend();
            }, 1200);
        }
    }
}

const pad = new AmbientPad();
const buttons = new Set<HTMLButtonElement>();

/** Every bound button toggles the same pad and mirrors its state. */
export function bindSoundToggle(button: HTMLButtonElement): void {
    buttons.add(button);
    button.addEventListener("click", async () => {
        await pad.set(!pad.playing);
        for (const item of buttons) render(item, pad.playing);
    });
}

function render(button: HTMLButtonElement, playing: boolean): void {
    button.setAttribute("aria-pressed", String(playing));
    button.classList.toggle("is-on", playing);
    const state = button.querySelector<HTMLElement>("[data-sound-state]");
    if (state) {
        blurSwap(state, () => {
            state.textContent = playing ? "On" : "Off";
        });
    }
}
