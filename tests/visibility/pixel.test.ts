import {Resvg} from "@resvg/resvg-js";
import {setImmediate} from "node:timers/promises";
import {expect, it} from "vite-plus/test";
import {faceSVG} from "../../src/game/draw.ts";
import {type Face, FEATURES, KEYS, SKIN, valid} from "../../src/game/faces.ts";
import {regions, VB} from "../../src/game/geometry.ts";
import {styleOf} from "../../src/game/styles/index.ts";

// Pixel Arcade draws on a grid, so a render at one pixel per card unit lands every cell on whole pixels.
const PIXEL = styleOf("pixel");
const WIDTH = VB[2]!;
const BASE = Object.fromEntries(KEYS.map((k) => [k, 0])) as Face;
// The hats that cover the crown of the head.
const CROWNED = [1, 3, 4, 7, 8, 9];
// One cell of the grid.
const CELL = 4;
// How far a cap's bill may hang below the hat's region.
const BILL = 4;

function render(f: Face): Uint8Array
{
	return new Resvg(
		faceSVG(f, {}, PIXEL),
		{
			fitTo:
			{
				mode: "width",
				value: WIDTH,
			},
			// A background no drawing uses, so a white shine drawn past the shoulders still shows.
			background: "#f0f",
			font:
			{
				loadSystemFonts: false,
			},
		},
	).render().pixels;
}

// The rows and columns of every pixel that differs between two renders.
function changed(a: Uint8Array, b: Uint8Array): [number, number][]
{
	const out: [number, number][] = [];
	for (let i = 0; i < a.length; i += 4)
	{
		if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])
			out.push([(i / 4) % WIDTH, Math.floor(i / 4 / WIDTH)]);
	}
	return out;
}

it("draws the pearls as a mirror image about the middle of the face", () =>
{
	const cells = changed(
		render(BASE),
		render(
			{
				...BASE,
				neckwear: 2,
			},
		),
	);
	const drawn = new Set(cells.map(([x, y]) => `${x} ${y}`));
	expect(cells.filter(([x, y]) => !drawn.has(`${WIDTH - 1 - x} ${y}`))).toStrictEqual([]);
});

it("changes nothing beside the face when only the hat changes", async () =>
{
	const moved: string[] = [];
	for (const hairStyle of Array.from(
		{
			length: FEATURES.hairStyle.n,
		},
		(_, v) => v,
	))
	{
		await setImmediate();
		const face = (hat: number): Face => (
		{
			...BASE,
			hairStyle,
			hat,
		});
		const bare = render(face(0));
		// The bottom of the hat's region, where Spot the Difference highlights it.
		const [[, cy, , ry]] = regions(face(0), "hat") as [[number, number, number, number]];
		const lowest = cy + ry + BILL - VB[1]!;
		for (const hat of CROWNED.filter((h) => valid(face(h))))
		{
			if (changed(bare, render(face(hat))).some(([, y]) => y > lowest))
				moved.push(`hair ${hairStyle} hat ${hat}`);
		}
	}
	expect(moved).toStrictEqual([]);
});

// A brow that touches the eye below it reads as part of the eye, so a row of skin always parts them.
it("leaves a row of skin between every eyebrow and the eye below it", () =>
{
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(SKIN[0]!.slice(i, i + 2), 16));
	const touching: string[] = [];
	for (const eyes of Array.from(
		{
			length: FEATURES.eyes.n,
		},
		(_, v) => v,
	))
	{
		for (const eyebrows of Array.from(
			{
				length: FEATURES.eyebrows.n,
			},
			(_, v) => v,
		))
		{
			const face: Face =
			{
				...BASE,
				eyes,
				eyebrows,
			};
			const pixels = render(face);
			// Eyebrows keep the natural hair color, so a hair color change finds every pixel of them.
			const brow = new Set(
				changed(
					pixels,
					render(
						{
							...face,
							hairColor: 2,
						},
					),
				).map(([x, y]) => y * WIDTH + x),
			);
			const skin = (i: number): boolean =>
				pixels[i * 4] === r && pixels[i * 4 + 1] === g && pixels[i * 4 + 2] === b;
			const touches = [...brow].some((i) =>
				Array.from(
					{
						length: CELL,
					},
					(_, k) => i + (k + 1) * WIDTH,
				).some((below) => !brow.has(below) && !skin(below)),
			);
			if (touches) touching.push(`eyes ${eyes} eyebrows ${eyebrows}`);
		}
	}
	expect(touching).toStrictEqual([]);
});
