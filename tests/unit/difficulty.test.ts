import {expect, it} from "vite-plus/test";
import {cfg} from "../../src/game/difficulty.ts";
import {type FeatureKey, KEYS} from "../../src/game/faces.ts";

const LEVELS = Array.from(
	{
		length: 45,
	},
	(_, i) => i + 1,
);

// Choices and features come first, up to six faces, the most a phone shows at a readable size. The time to answer
// shrinks a second every three levels, and only once every feature is in play does the time to memorize shrink too, a
// second every six levels.
it("adds choices and features before it shortens the time to memorize", () =>
{
	expect(
		LEVELS.map(
			(L) =>
				`${L}: ${cfg(L).choices} choices, ${cfg(L).changes} apart, ${cfg(L).mem}s to memorize, ${cfg(L).pick}s to answer`,
		),
	).toStrictEqual([
		"1: 3 choices, 3 apart, 12s to memorize, 22s to answer",
		"2: 3 choices, 3 apart, 12s to memorize, 22s to answer",
		"3: 4 choices, 3 apart, 12s to memorize, 22s to answer",
		"4: 4 choices, 3 apart, 12s to memorize, 21s to answer",
		"5: 5 choices, 2 apart, 12s to memorize, 21s to answer",
		"6: 5 choices, 2 apart, 12s to memorize, 21s to answer",
		"7: 6 choices, 2 apart, 12s to memorize, 20s to answer",
		"8: 6 choices, 2 apart, 12s to memorize, 20s to answer",
		"9: 6 choices, 1 apart, 12s to memorize, 20s to answer",
		"10: 6 choices, 1 apart, 12s to memorize, 19s to answer",
		"11: 6 choices, 1 apart, 12s to memorize, 19s to answer",
		"12: 6 choices, 1 apart, 12s to memorize, 19s to answer",
		"13: 6 choices, 1 apart, 12s to memorize, 18s to answer",
		"14: 6 choices, 1 apart, 12s to memorize, 18s to answer",
		"15: 6 choices, 1 apart, 12s to memorize, 18s to answer",
		"16: 6 choices, 1 apart, 12s to memorize, 17s to answer",
		"17: 6 choices, 1 apart, 12s to memorize, 17s to answer",
		"18: 6 choices, 1 apart, 11s to memorize, 17s to answer",
		"19: 6 choices, 1 apart, 11s to memorize, 16s to answer",
		"20: 6 choices, 1 apart, 11s to memorize, 16s to answer",
		"21: 6 choices, 1 apart, 11s to memorize, 16s to answer",
		"22: 6 choices, 1 apart, 11s to memorize, 15s to answer",
		"23: 6 choices, 1 apart, 11s to memorize, 15s to answer",
		"24: 6 choices, 1 apart, 10s to memorize, 15s to answer",
		"25: 6 choices, 1 apart, 10s to memorize, 14s to answer",
		"26: 6 choices, 1 apart, 10s to memorize, 14s to answer",
		"27: 6 choices, 1 apart, 10s to memorize, 14s to answer",
		"28: 6 choices, 1 apart, 10s to memorize, 13s to answer",
		"29: 6 choices, 1 apart, 10s to memorize, 13s to answer",
		"30: 6 choices, 1 apart, 9s to memorize, 13s to answer",
		"31: 6 choices, 1 apart, 9s to memorize, 12s to answer",
		"32: 6 choices, 1 apart, 9s to memorize, 12s to answer",
		"33: 6 choices, 1 apart, 9s to memorize, 12s to answer",
		"34: 6 choices, 1 apart, 9s to memorize, 11s to answer",
		"35: 6 choices, 1 apart, 9s to memorize, 11s to answer",
		"36: 6 choices, 1 apart, 8s to memorize, 11s to answer",
		"37: 6 choices, 1 apart, 8s to memorize, 10s to answer",
		"38: 6 choices, 1 apart, 8s to memorize, 10s to answer",
		"39: 6 choices, 1 apart, 8s to memorize, 10s to answer",
		"40: 6 choices, 1 apart, 8s to memorize, 10s to answer",
		"41: 6 choices, 1 apart, 8s to memorize, 10s to answer",
		"42: 6 choices, 1 apart, 7s to memorize, 10s to answer",
		"43: 6 choices, 1 apart, 7s to memorize, 10s to answer",
		"44: 6 choices, 1 apart, 7s to memorize, 10s to answer",
		"45: 6 choices, 1 apart, 7s to memorize, 10s to answer",
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
