import {describe, expect, it} from "vite-plus/test";
import
{
	emptyBoards,
	levelPoints,
	maxScoreForLevel,
	minScoreForLevel,
	sortTop,
	validateSubmission,
} from "../../src/shared/scores.ts";
import {legacySource} from "../support/legacy.ts";

describe("levelPoints", () =>
{
	it("is the original award() formula", () =>
	{
		expect(legacySource()).toContain(
			"function award(frac){const pts=100+10*(G.level-1)+Math.round(100*frac);G.score+=pts;",
		);
		expect([levelPoints(1, 0), levelPoints(1, 1), levelPoints(3, 0.5), levelPoints(10, 0.004)]).toStrictEqual([
			100, 200, 170, 190,
		]);
	});
});

// The game records G.level at game over, and G.level only moves past a level once it is cleared,
// so a score submitted at level l holds the award for levels 1 through l - 1.
function sum(level: number, frac: number): number
{
	let total = 0;
	for (let L = 1; L < level; L++) total += levelPoints(L, frac);
	return total;
}

describe("the score bound for a level", () =>
{
	it("is the sum of the awards for every cleared level, all fast or all slow", () =>
	{
		for (let level = 1; level <= 200; level++)
		{
			expect([minScoreForLevel(level), maxScoreForLevel(level)]).toStrictEqual([sum(level, 0), sum(level, 1)]);
		}
	});

	it("has these closed forms", () =>
	{
		expect([1, 2, 3, 6, 9].map((l) => [minScoreForLevel(l), maxScoreForLevel(l)])).toStrictEqual([
			[0, 0],
			[100, 200],
			[210, 410],
			[600, 1100],
			[1080, 1880],
		]);
	});

	it("holds every score in the test fixtures", () =>
	{
		for (const [s, l] of [
			[1626, 9],
			[1506, 8],
			[1185, 7],
			[1009, 6],
		] as const)
		{
			expect(s >= minScoreForLevel(l) && s <= maxScoreForLevel(l)).toBe(true);
		}
	});
});

describe("sortTop", () =>
{
	it("ranks by score, then the earlier time, and keeps ten per mode", () =>
	{
		const boards = emptyBoards();
		boards.classic = Array.from(
			{
				length: 12,
			},
			(_, i) => (
			{
				n: `p${i}`,
				s: 100 * (i % 4),
				l: 1,
				t: 1000 - i,
			}),
		);
		expect(sortTop(boards).classic.map((e) => e.n)).toStrictEqual([
			"p11",
			"p7",
			"p3",
			"p10",
			"p6",
			"p2",
			"p9",
			"p5",
			"p1",
			"p8",
		]);
	});
});

describe("validateSubmission", () =>
{
	const good =
	{
		mode: "classic",
		name: "  Alice  ",
		score: 1626,
		level: 9,
		deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
	};

	it("accepts a real score and trims the name", () =>
	{
		expect(validateSubmission(good)).toStrictEqual(
			{
				ok: true,
				value:
				{
					mode: "classic",
					name: "Alice",
					score: 1626,
					level: 9,
					deviceId: good.deviceId,
				},
			},
		);
	});

	it("accepts the edges of the bound and of the name", () =>
	{
		for (const body of [
			{
				...good,
				score: maxScoreForLevel(9),
			},
			{
				...good,
				score: minScoreForLevel(9),
			},
			{
				...good,
				level: 1,
				score: 0,
			},
			{
				...good,
				name: "a",
			},
			{
				...good,
				name: "abcdefghijkl",
			},
			{
				...good,
				mode: "lineup",
			},
			{
				...good,
				extra: "ignored",
			},
		])
			expect(validateSubmission(body).ok).toBe(true);
	});

	it("rejects anything else with a reason", () =>
	{
		const cases: [unknown, string][] = [
			[null, "body must be a JSON object"],
			[[good], "body must be a JSON object"],
			["x", "body must be a JSON object"],
			[
				{
					...good,
					mode: "arcade",
				},
				"mode must be one of classic, spot, build, lineup",
			],
			[
				{
					...good,
					mode: undefined,
				},
				"mode must be one of classic, spot, build, lineup",
			],
			[
				{
					...good,
					name: "   ",
				},
				"name must be 1 to 12 characters",
			],
			[
				{
					...good,
					name: "abcdefghijklm",
				},
				"name must be 1 to 12 characters",
			],
			[
				{
					...good,
					name: 7,
				},
				"name must be 1 to 12 characters",
			],
			[
				{
					...good,
					name: "a\u0000b",
				},
				"name must not contain control characters",
			],
			[
				{
					...good,
					level: 0,
					score: 0,
				},
				"level must be an integer of at least 1",
			],
			[
				{
					...good,
					level: 2.5,
				},
				"level must be an integer of at least 1",
			],
			[
				{
					...good,
					level: "9",
				},
				"level must be an integer of at least 1",
			],
			[
				{
					...good,
					score: 1626.5,
				},
				"score must be a whole number",
			],
			[
				{
					...good,
					score: "1626",
				},
				"score must be a whole number",
			],
			[
				{
					...good,
					score: maxScoreForLevel(9) + 1,
				},
				"score is not possible at level 9",
			],
			[
				{
					...good,
					score: minScoreForLevel(9) - 1,
				},
				"score is not possible at level 9",
			],
			[
				{
					...good,
					level: 1,
					score: 1,
				},
				"score is not possible at level 1",
			],
			[
				{
					...good,
					deviceId: "short",
				},
				"deviceId must be 8 to 64 letters, digits, - or _",
			],
			[
				{
					...good,
					deviceId: "x".repeat(65),
				},
				"deviceId must be 8 to 64 letters, digits, - or _",
			],
			[
				{
					...good,
					deviceId: "has space!",
				},
				"deviceId must be 8 to 64 letters, digits, - or _",
			],
		];
		expect(cases.map(([body]) => validateSubmission(body))).toStrictEqual(
			cases.map(([, error]) => (
			{
				ok: false,
				error,
			})),
		);
	});
});
