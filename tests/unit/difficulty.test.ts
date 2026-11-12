import {expect, it} from "vite-plus/test";
import {cfg} from "../../src/game/difficulty.ts";
import {type FeatureKey, KEYS} from "../../src/game/faces.ts";

const LEVELS = Array.from(
	{
		length: 32,
	},
	(_, i) => i + 1,
);

// Choices and features come first; only once all are in play does the time to memorize shrink. Both times start two
// seconds longer than the hardest levels' pace would have them, and keep the same pace down to the same floor.
it("adds choices and features before it shortens the time to memorize", () =>
{
	expect(
		LEVELS.map(
			(L) =>
				`${L}: ${cfg(L).choices} choices, ${cfg(L).changes} apart, ${cfg(L).mem}s to memorize, ${cfg(L).pick}s to answer`,
		),
	).toStrictEqual([
		"1: 3 choices, 3 apart, 12s to memorize, 22s to answer",
		"2: 3 choices, 3 apart, 12s to memorize, 21s to answer",
		"3: 4 choices, 3 apart, 12s to memorize, 20s to answer",
		"4: 4 choices, 3 apart, 12s to memorize, 19s to answer",
		"5: 5 choices, 2 apart, 12s to memorize, 18s to answer",
		"6: 5 choices, 2 apart, 12s to memorize, 17s to answer",
		"7: 6 choices, 2 apart, 12s to memorize, 16s to answer",
		"8: 6 choices, 2 apart, 12s to memorize, 15s to answer",
		"9: 7 choices, 1 apart, 12s to memorize, 14s to answer",
		"10: 7 choices, 1 apart, 12s to memorize, 13s to answer",
		"11: 8 choices, 1 apart, 12s to memorize, 12s to answer",
		"12: 8 choices, 1 apart, 12s to memorize, 11s to answer",
		"13: 8 choices, 1 apart, 11s to memorize, 10s to answer",
		"14: 8 choices, 1 apart, 11s to memorize, 9s to answer",
		"15: 8 choices, 1 apart, 11s to memorize, 8s to answer",
		"16: 8 choices, 1 apart, 10s to memorize, 7s to answer",
		"17: 8 choices, 1 apart, 10s to memorize, 6s to answer",
		"18: 8 choices, 1 apart, 10s to memorize, 6s to answer",
		"19: 8 choices, 1 apart, 9s to memorize, 6s to answer",
		"20: 8 choices, 1 apart, 9s to memorize, 6s to answer",
		"21: 8 choices, 1 apart, 9s to memorize, 6s to answer",
		"22: 8 choices, 1 apart, 8s to memorize, 6s to answer",
		"23: 8 choices, 1 apart, 8s to memorize, 6s to answer",
		"24: 8 choices, 1 apart, 8s to memorize, 6s to answer",
		"25: 8 choices, 1 apart, 7s to memorize, 6s to answer",
		"26: 8 choices, 1 apart, 7s to memorize, 6s to answer",
		"27: 8 choices, 1 apart, 7s to memorize, 6s to answer",
		"28: 8 choices, 1 apart, 6s to memorize, 6s to answer",
		"29: 8 choices, 1 apart, 6s to memorize, 6s to answer",
		"30: 8 choices, 1 apart, 6s to memorize, 6s to answer",
		"31: 8 choices, 1 apart, 5s to memorize, 6s to answer",
		"32: 8 choices, 1 apart, 5s to memorize, 6s to answer",
	]);
});

// A level adds features to the ones before it rather than trading the big ones away.
it("keeps every feature in play once it is added, and has them all by level 9", () =>
{
	const dropped = LEVELS.slice(1).flatMap((L) =>
		cfg(L - 1)
			.pool.filter((k) => !cfg(L).pool.includes(k))
			.map((k) => `${k} at ${L}`),
	);
	expect(
		{
			dropped,
			missingAt9: KEYS.filter((k) => !cfg(9).pool.includes(k)),
		},
	).toStrictEqual(
		{
			dropped: [],
			missingAt9: [],
		},
	);
});

// Noses, mouths, ears and cheeks are small or drawn as fine lines, so only from level 7 does a round turn on them.
const SUBTLE: FeatureKey[] = ["nose", "mouth", "ears", "cheeks"];

it("keeps the subtle features out of the first six levels", () =>
{
	const firstAsked = Object.fromEntries(
		SUBTLE.map((k) => [
			k,
			Array.from(
				{
					length: 30,
				},
				(_, i) => i + 1,
			).find((L) => cfg(L).pool.includes(k)),
		]),
	);
	expect(firstAsked).toStrictEqual(
		{
			nose: 7,
			mouth: 7,
			ears: 7,
			cheeks: 7,
		},
	);
});
