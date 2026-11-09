import {Resvg} from "@resvg/resvg-js";
import {expect, it} from "vite-plus/test";
import {faceSVG} from "../../src/game/draw.ts";
import {diffKeys, type Face, FEATURES, type FeatureKey, KEYS, valid} from "../../src/game/faces.ts";

// A card-sized render, without the hand-drawn wobble so the same face always gives the same pixels.
const WIDTH = 200;
// A change is visible when it alters this many pixels, or the other features leave at least this share of what it alters on an unobstructed face.
const MIN_PIXELS = 150;
const MIN_SHARE = 0.5;
// How far apart two pixels' colors must be, summed over red, green and blue, to count as changed.
const MIN_COLOR_DISTANCE = 16;
// How much of an eye color change's total color difference must show through glasses.
const MIN_UNTINTED_SHARE = 0.95;

const BASE = Object.fromEntries(KEYS.map((k) => [k, 0])) as Face;
const values = (k: FeatureKey): number[] =>
	Array.from(
		{
			length: FEATURES[k].n,
		},
		(_, v) => v,
	);

function render(f: Face): Uint8Array
{
	const svg = faceSVG(f).replace(' filter="url(#wob)"', "");
	return new Resvg(
		svg,
		{
			fitTo:
			{
				mode: "width",
				value: WIDTH,
			},
			background: "#fff",
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
it("draws every difference the game counts so that it can be seen", () =>
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
			uncounted: new Set(["hatColor"]),
		},
	);
});

// Lenses may frame the eyes but not tint them: an eye color change keeps nearly all of its color difference behind every pair of glasses.
it("shows eye color through every pair of glasses untinted", () =>
{
	const worst = new Map<number, number>();
	for (const eyes of values("eyes"))
	{
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
