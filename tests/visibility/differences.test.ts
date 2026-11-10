import {Resvg} from "@resvg/resvg-js";
import {setImmediate} from "node:timers/promises";
import {expect, it} from "vite-plus/test";
import {faceSVG} from "../../src/game/draw.ts";
import {DEFAULT_STYLE, styleOf} from "../../src/game/styles/index.ts";
import type {StyleId} from "../../src/game/styles/style.ts";
import
{
	CLOTH,
	diffKeys,
	DYEC,
	EYEC,
	type Face,
	FEATURES,
	type FeatureKey,
	HAIRC,
	HATC,
	KEYS,
	SKIN,
	valid,
} from "../../src/game/faces.ts";

// The style under test: `STYLE=paper just test-visibility` checks one, and `just test-visibility-all` every one.
const STYLE = styleOf((process.env["STYLE"] ?? DEFAULT_STYLE) as StyleId);
// A card-sized render, without any style's filters so the same face always gives the same pixels.
const WIDTH = 200;
// A change is visible when it alters this many pixels, or the other features leave at least this share of what it alters on an unobstructed face.
const MIN_PIXELS = 150;
const MIN_SHARE = 0.5;
// How far apart two pixels' colors must be, summed over red, green and blue, to count as changed.
const MIN_COLOR_DISTANCE = 16;
// How much of an eye color change's total color difference must show through glasses.
const MIN_UNTINTED_SHARE = 0.999;
// How many pixels any two values of one feature must differ by on a bare face, so no two options read as the same one.
const MIN_DISTINCT_PIXELS = 200;
// Noses and mouths are drawn as fine lines on purpose, so they are held to a lower count.
const MIN_FINE_LINE_PIXELS = 100;
const FINE_LINES = new Set<FeatureKey>(["nose", "mouth"]);
// A fine line stands out when it is this far from the skin under it, and this many of its pixels must.
const MIN_LINE_CONTRAST = 200;
const MIN_CONTRAST_PIXELS = 40;
// How far apart any two colors of one palette must be, as a CIE76 distance.
const MIN_PALETTE_DISTANCE = 20;
const PALETTES: Partial<Record<FeatureKey, readonly string[]>> =
{
	skin: SKIN,
	hairColor: HAIRC,
	hairDye: DYEC.slice(1),
	eyeColor: EYEC,
	shirt: CLOTH,
	hatColor: HATC,
};

const BASE = Object.fromEntries(KEYS.map((k) => [k, 0])) as Face;
const values = (k: FeatureKey): number[] =>
	Array.from(
		{
			length: FEATURES[k].n,
		},
		(_, v) => v,
	);

// resvg frees a render's memory only from a callback that runs once the event loop turns, so a loop that renders
// without yielding holds every render it made: thousands of them outgrow a CI runner. Each test awaits breathe() as it
// goes.
const breathe = async (): Promise<void> => setImmediate();
function render(f: Face, background = "#fff"): Uint8Array
{
	const svg = faceSVG(f, {}, STYLE).replaceAll(/ filter="url\(#[\w-]+\)"/g, "");
	return new Resvg(
		svg,
		{
			fitTo:
			{
				mode: "width",
				value: WIDTH,
			},
			background,
			font:
			{
				loadSystemFonts: false,
			},
		},
	).render().pixels;
}

function colorDistance(a: Uint8Array, b: Uint8Array, i: number): number
{
	return Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
}

function totalDistance(a: Uint8Array, b: Uint8Array): number
{
	let n = 0;
	for (let i = 0; i < a.length; i += 4) n += colorDistance(a, b, i);
	return n;
}

function changedPixels(a: Uint8Array, b: Uint8Array): number
{
	let n = 0;
	for (let i = 0; i < a.length; i += 4)
	{
		if (colorDistance(a, b, i) > MIN_COLOR_DISTANCE) n++;
	}
	return n;
}

const unobstructed = new Map<string, number>();
function unobstructedPixels(k: FeatureKey, a: number, b: number, shape: number): number
{
	const id = `${k} ${a} ${b} ${shape}`;
	let n = unobstructed.get(id);
	if (n === undefined)
	{
		n = changedPixels(
			render(
				{
					...BASE,
					faceShape: shape,
					[k]: a,
				},
			),
			render(
				{
					...BASE,
					faceShape: shape,
					[k]: b,
				},
			),
		);
		unobstructed.set(id, n);
	}
	return n;
}

// Every change of one feature, next to every value of one other feature, on every face shape.
it("draws every difference the game counts so that it can be seen", async () =>
{
	const hidden = new Set<string>();
	const uncounted = new Set<FeatureKey>();
	for (const [i, k] of KEYS.entries())
	{
		for (const c of KEYS.slice(i + 1))
		{
			const shapes = k === "faceShape" || c === "faceShape" ? [BASE.faceShape] : values("faceShape");
			for (const shape of shapes)
			{
				await breathe();
				const face = (kv: number, cv: number): Face => (
				{
					...BASE,
					faceShape: shape,
					[k]: kv,
					[c]: cv,
				});
				const pixels = values(k).map((kv) =>
					values(c).map((cv) => (valid(face(kv, cv)) ? render(face(kv, cv)) : null)),
				);
				const compare = (
					changed: FeatureKey,
					a: number,
					b: number,
					other: FeatureKey,
					ov: number,
					pa: Uint8Array | null,
					pb: Uint8Array | null,
				): void =>
				{
					if (!pa || !pb) return;
					const fa = changed === k ? face(a, ov) : face(ov, a);
					const fb = changed === k ? face(b, ov) : face(ov, b);
					if (diffKeys(fa, fb).length === 0)
					{
						uncounted.add(changed);
						return;
					}
					const n = changedPixels(pa, pb);
					if (n < MIN_PIXELS && n < MIN_SHARE * unobstructedPixels(changed, a, b, fa.faceShape))
						hidden.add(`${changed} ${a}→${b} with ${other} ${ov}`);
				};
				for (const [ci, cv] of values(c).entries())
					for (const [ai, a] of values(k).entries())
						for (const b of values(k).slice(ai + 1))
							compare(k, a, b, c, cv, pixels[ai]![ci]!, pixels[b]![ci]!);
				for (const [ki, kv] of values(k).entries())
					for (const [ai, a] of values(c).entries())
						for (const b of values(c).slice(ai + 1))
							compare(c, a, b, k, kv, pixels[ki]![ai]!, pixels[ki]![b]!);
			}
		}
	}
	expect(
		{
			hidden: [...hidden].toSorted(),
			uncounted,
		},
	).toStrictEqual(
		{
			hidden: [],
			uncounted: new Set(["hairDye", "hatColor"]),
		},
	);
});

// Lenses may frame the eyes but not tint them: an eye color change keeps nearly all of its color difference behind every pair of glasses.
it("shows eye color through every pair of glasses untinted", async () =>
{
	const worst = new Map<number, number>();
	for (const eyes of values("eyes"))
	{
		await breathe();
		for (const [ai, a] of values("eyeColor").entries())
		{
			for (const b of values("eyeColor").slice(ai + 1))
			{
				const distance = (glasses: number): number =>
					totalDistance(
						render(
							{
								...BASE,
								eyes,
								glasses,
								eyeColor: a,
							},
						),
						render(
							{
								...BASE,
								eyes,
								glasses,
								eyeColor: b,
							},
						),
					);
				const bare = distance(0);
				for (const glasses of values("glasses").slice(1))
				{
					const share = distance(glasses) / bare;
					worst.set(glasses, Math.min(worst.get(glasses) ?? 1, share));
				}
			}
		}
	}
	const tinted = [...worst]
		.filter(([, share]) => share < MIN_UNTINTED_SHARE)
		.map(([glasses, share]) => `glasses ${glasses}: ${share.toFixed(2)}`);
	expect(tinted).toStrictEqual([]);
});

const labCurve = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

function lab(hex: string): [number, number, number]
{
	const n = parseInt(hex.slice(1), 16);
	const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
	{
		const c = v / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	const x = labCurve((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
	const y = labCurve(r * 0.2126 + g * 0.7152 + b * 0.0722);
	const z = labCurve((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
	return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// Two options of one feature that look alike make a round a guess, whatever else is on the face.
it("draws every value of a feature unlike its other values", async () =>
{
	const alike: string[] = [];
	for (const k of KEYS)
	{
		await breathe();
		const palette = PALETTES[k];
		if (palette)
		{
			for (const [a, ca] of palette.entries())
			{
				for (const [b, cb] of [...palette.entries()].slice(a + 1))
				{
					const [la, lb] = [lab(ca), lab(cb)];
					const distance = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
					if (distance < MIN_PALETTE_DISTANCE)
						alike.push(`${k} ${a}↔${b}: color distance ${distance.toFixed(0)}`);
				}
			}
			continue;
		}
		const pixels = values(k).map((v) =>
			render(
				{
					...BASE,
					[k]: v,
				},
			),
		);
		for (const [a, pa] of pixels.entries())
		{
			for (const [b, pb] of [...pixels.entries()].slice(a + 1))
			{
				const n = changedPixels(pa, pb);
				if (n < (FINE_LINES.has(k) ? MIN_FINE_LINE_PIXELS : MIN_DISTINCT_PIXELS))
					alike.push(`${k} ${a}↔${b}: ${n} pixels`);
			}
		}
	}
	expect(alike).toStrictEqual([]);
});

// On a grey card the only pure white a bare face draws is its eyes, and an eye color change marks the irises.
it("keeps every pair of glasses clear of the eyes", async () =>
{
	const GREY = "#808080";
	const covered: string[] = [];
	for (const eyes of values("eyes"))
	{
		await breathe();
		const face = (glasses: number, eyeColor = 0): Face => (
		{
			...BASE,
			skin: 2,
			eyes,
			eyeColor,
			glasses,
		});
		const bare = render(face(0), GREY);
		const recolored = render(face(0, 1), GREY);
		for (const glasses of values("glasses").slice(1))
		{
			const worn = render(face(glasses), GREY);
			let n = 0;
			for (let i = 0; i < bare.length; i += 4)
			{
				const white = bare[i]! + bare[i + 1]! + bare[i + 2]!;
				const eye = white === 765 || colorDistance(bare, recolored, i) > 0;
				if (eye && colorDistance(bare, worn, i) > MIN_COLOR_DISTANCE) n++;
			}
			if (n > 0) covered.push(`glasses ${glasses} on eyes ${eyes}: ${n} pixels`);
		}
	}
	expect(covered).toStrictEqual([]);
});

// Ink on the darkest skins is dark on dark, so the lines drawn on the face must change color with the skin.
it("draws noses and mouths that stand out on every skin", async () =>
{
	const faint: string[] = [];
	for (const skin of values("skin"))
	{
		await breathe();
		for (const k of FINE_LINES)
		{
			const pixels = values(k).map((v) =>
				render(
					{
						...BASE,
						skin,
						[k]: v,
					},
				),
			);
			for (const [a, pa] of pixels.entries())
			{
				for (const [b, pb] of [...pixels.entries()].slice(a + 1))
				{
					let n = 0;
					for (let i = 0; i < pa.length; i += 4)
					{
						if (colorDistance(pa, pb, i) > MIN_LINE_CONTRAST) n++;
					}
					if (n < MIN_CONTRAST_PIXELS) faint.push(`${k} ${a}↔${b} on skin ${skin}: ${n} pixels`);
				}
			}
		}
	}
	expect(faint).toStrictEqual([]);
});
