import {Resvg} from "@resvg/resvg-js";
import {faceSVG} from "../../src/game/draw.ts";
import {type Face, FEATURES, type FeatureKey, KEYS} from "../../src/game/faces.ts";
import {DEFAULT_STYLE, styleOf} from "../../src/game/styles/index.ts";
import type {StyleId} from "../../src/game/styles/style.ts";

// The style under test: `STYLE=paper just test-visibility` checks one, and `just test-visibility-all` every one.
const STYLE = styleOf((process.env["STYLE"] ?? DEFAULT_STYLE) as StyleId);
// A card-sized render, without any style's filters so the same face always gives the same pixels.
export const WIDTH = 200;
// How far apart two pixels' colors must be, summed over red, green and blue, to count as changed.
export const MIN_COLOR_DISTANCE = 16;

export const BASE = Object.fromEntries(KEYS.map((k) => [k, 0])) as Face;
export const values = (k: FeatureKey): number[] =>
	Array.from(
		{
			length: FEATURES[k].n,
		},
		(_, v) => v,
	);

export function render(f: Face, background = "#fff"): Uint8Array
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

export function colorDistance(a: Uint8Array, b: Uint8Array, i: number): number
{
	return Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
}

export function changedPixels(a: Uint8Array, b: Uint8Array): number
{
	let n = 0;
	for (let i = 0; i < a.length; i += 4)
	{
		if (colorDistance(a, b, i) > MIN_COLOR_DISTANCE) n++;
	}
	return n;
}
