import {expect, it} from "vite-plus/test";
import {cfg} from "../../src/game/difficulty.ts";
import {type FeatureKey, KEYS} from "../../src/game/faces.ts";

const LEVELS = Array.from(
	{
		length: 26,
	},
	(_, i) => i + 1,
);

// Choices and features come first; only once all are in play does the time to memorize shrink.
it("adds choices and features before it shortens the time to memorize", () =>
{
	expect(LEVELS.map((L) => `${L}: ${cfg(L).choices} choices, ${cfg(L).changes} apart, ${cfg(L).mem}s`)).toStrictEqual(
		[
			"1: 3 choices, 3 apart, 10s",
			"2: 3 choices, 3 apart, 10s",
			"3: 4 choices, 3 apart, 10s",
			"4: 4 choices, 3 apart, 10s",
			"5: 5 choices, 2 apart, 10s",
			"6: 5 choices, 2 apart, 10s",
			"7: 6 choices, 2 apart, 10s",
			"8: 6 choices, 2 apart, 10s",
			"9: 7 choices, 1 apart, 10s",
			"10: 7 choices, 1 apart, 10s",
			"11: 8 choices, 1 apart, 10s",
			"12: 8 choices, 1 apart, 10s",
			"13: 8 choices, 1 apart, 9s",
			"14: 8 choices, 1 apart, 9s",
			"15: 8 choices, 1 apart, 9s",
			"16: 8 choices, 1 apart, 8s",
			"17: 8 choices, 1 apart, 8s",
			"18: 8 choices, 1 apart, 8s",
			"19: 8 choices, 1 apart, 7s",
			"20: 8 choices, 1 apart, 7s",
			"21: 8 choices, 1 apart, 7s",
			"22: 8 choices, 1 apart, 6s",
			"23: 8 choices, 1 apart, 6s",
			"24: 8 choices, 1 apart, 6s",
			"25: 8 choices, 1 apart, 5s",
			"26: 8 choices, 1 apart, 5s",
		],
	);
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
