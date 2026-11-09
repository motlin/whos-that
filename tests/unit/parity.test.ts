import {afterEach, describe, expect, it, vi} from "vite-plus/test";
import {buildCount, buildMem, buildOpts, cfg, stage} from "../../src/game/difficulty.ts";
import {cropBox, faceSVG} from "../../src/game/draw.ts";
import {diffKeys, type Face, KEYS, makeDecoy, randomFace, visKey} from "../../src/game/faces.ts";
import {loadLegacyCore, seeded} from "../support/legacy.ts";

const legacy = loadLegacyCore();
const SEEDS = Array.from(
	{
		length: 200,
	},
	(_, i) => i + 1,
);

// Draws the same random numbers in the original script and in the port, then runs fn in each.
function both<T>(seed: number, port: () => T, original: () => T): [T, T]
{
	legacy.setRandom(seeded(seed));
	// Objects from the other realm carry its prototypes, which strict equality would count as a difference.
	const expected = structuredClone(original());
	vi.spyOn(Math, "random").mockImplementation(seeded(seed));
	const actual = port();
	vi.restoreAllMocks();
	return [actual, expected];
}

afterEach(() =>
{
	vi.restoreAllMocks();
});

describe("the port matches the original script", () =>
{
	it("lists the same features in the same order", () =>
	{
		expect(KEYS).toStrictEqual(structuredClone(legacy.KEYS));
	});

	it("generates the same random faces", () =>
	{
		for (const seed of SEEDS)
		{
			const [actual, expected] = both(
				seed,
				() => randomFace(),
				() => legacy.randomFace(),
			);
			expect(actual).toStrictEqual(expected);
		}
	});

	it("draws every face, its highlights and its crops to the same SVG", () =>
	{
		for (const seed of SEEDS)
		{
			const [face] = both(
				seed,
				() => randomFace(),
				() => legacy.randomFace(),
			);
			const keys = KEYS.filter((_, i) => (i + seed) % 3 === 0);
			expect(faceSVG(face)).toBe(legacy.faceSVG(face));
			expect(
				faceSVG(
					face,
					{
						hl: keys,
						good: seed % 2 === 0,
					},
				),
			).toBe(
				legacy.faceSVG(
					face,
					{
						hl: keys,
						good: seed % 2 === 0,
					},
				),
			);
			expect(
				faceSVG(
					face,
					{
						hl: keys,
						mark: [seed, seed / 2],
					},
				),
			).toBe(
				legacy.faceSVG(
					face,
					{
						hl: keys,
						mark: [seed, seed / 2],
					},
				),
			);
			for (const k of KEYS)
			{
				expect(cropBox(face, k)).toBe(legacy.cropBox(face, k));
				expect(
					faceSVG(
						face,
						{
							vb: cropBox(face, k),
						},
					),
				).toBe(
					legacy.faceSVG(
						face,
						{
							vb: legacy.cropBox(face, k),
						},
					),
				);
			}
		}
	});

	it("makes the same decoys and finds the same differences", () =>
	{
		for (const seed of SEEDS)
		{
			const level = (seed % 20) + 1;
			const run = (decoy: typeof makeDecoy, random: () => Face, key: typeof visKey): Face[] =>
			{
				const t = random();
				const used = new Set([key(t)]);
				return [t, decoy(t, cfg(level).changes, cfg(level).pool, used), decoy(t, 1, cfg(level).pool, used)];
			};
			const [actual, expected] = both(
				seed,
				() => run(makeDecoy, randomFace, visKey),
				() => run(legacy.makeDecoy, legacy.randomFace, legacy.visKey),
			);
			expect(actual).toStrictEqual(expected);
			const [t, d] = actual as [Face, Face];
			expect(diffKeys(t, d)).toStrictEqual(structuredClone(legacy.diffKeys(t, d)));
		}
	});

	it("scales difficulty the same way at every level", () =>
	{
		for (let L = 1; L <= 60; L++)
		{
			expect(
				{
					cfg: cfg(L),
					stage: stage(L),
					count: buildCount(L),
					mem: buildMem(L),
					opts: buildOpts(L),
				},
			).toStrictEqual(
				structuredClone(
					{
						cfg: legacy.cfg(L),
						stage: legacy.stage(L),
						count: legacy.buildCount(L),
						mem: legacy.buildMem(L),
						opts: legacy.buildOpts(L),
					},
				),
			);
		}
	});
});
