import {$, ls} from "./util.ts";

let AC: AudioContext | null = null,
	muted = ls.get("wt_mute") === "1";

interface AudioWindow
{
	AudioContext?: typeof AudioContext;
	webkitAudioContext?: typeof AudioContext;
}

function ac(): AudioContext | null
{
	if (!AC)
	{
		try
		{
			const w = window as unknown as AudioWindow;
			const Ctor = w.AudioContext ?? w.webkitAudioContext;
			if (Ctor) AC = new Ctor();
		}
		catch
		{
			// No audio on this browser, so the game stays silent.
		}
	}
	if (AC?.state === "suspended") AC.resume().catch(() => undefined);
	return AC;
}

function tone(fr: number, d: number, type: OscillatorType = "sine", v = 0.15, wt = 0, f2?: number): void
{
	if (muted) return;
	const a = ac();
	if (!a) return;
	const t = a.currentTime + wt;
	const o = a.createOscillator(),
		gn = a.createGain();
	o.type = type;
	o.frequency.setValueAtTime(fr, t);
	if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
	gn.gain.setValueAtTime(0.0001, t);
	gn.gain.exponentialRampToValueAtTime(v, t + 0.01);
	gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
	o.connect(gn).connect(a.destination);
	o.start(t);
	o.stop(t + d + 0.05);
}

export const SFX =
{
	click: (): void =>
	{
		tone(660, 0.06, "triangle", 0.12);
	},
	pop: (): void =>
	{
		tone(500, 0.09, "sine", 0.16, 0, 950);
	},
	tick: (): void =>
	{
		tone(1000, 0.05, "square", 0.05);
	},
	ding: (): void =>
	{
		tone(880, 0.15, "sine", 0.2);
		tone(1320, 0.28, "sine", 0.16, 0.09);
	},
	buzz: (): void =>
	{
		tone(190, 0.45, "sawtooth", 0.12, 0, 80);
	},
	fanfare: (): void =>
	{
		for (const [i, f] of [523, 659, 784, 1047, 1319].entries())
			tone(f, i === 4 ? 0.45 : 0.16, "triangle", 0.16, i * 0.11);
	},
	whoosh: (): void =>
	{
		tone(260, 0.28, "sine", 0.08, 0, 1100);
	},
};

function drawSnd(): void
{
	$("#snd").textContent = muted ? "🔇" : "🔊";
}

export function initSound(): void
{
	addEventListener(
		"pointerdown",
		() => ac(),
		{
			once: true,
		},
	);
	$("#snd").onclick = (): void =>
	{
		muted = !muted;
		ls.set("wt_mute", muted ? "1" : "0");
		drawSnd();
		SFX.click();
	};
	drawSnd();
}
