import {expect, it} from "vite-plus/test";
import {cfg} from "../../src/game/difficulty.ts";
import {diffKeys, type Face, KEYS, makeLineup, randomFace, valid, visKey} from "../../src/game/faces.ts";

// Levels that span the fewest, middling and most choices.
const LEVELS = [1, 7, 15];
const LINEUPS = 2000;
// How much better than a blind guess counting may do before it gives the answer away.
const MAX_EDGE = 0.05;

function lineup(L: number): Face[]
{
	const c = cfg(L),
		t = randomFace();
	return [t, ...makeLineup(t, c.choices, c.changes, c.pool, new Set([visKey(t)]))];
}

// The face whose values are the most common ones across the lineup, first among equals.
function mostTypical(faces: Face[]): number
{
	const score = faces.map((f) => KEYS.reduce((s, k) => s + faces.filter((g) => g[k] === f[k]).length, 0));
	const best = Math.max(...score);
	const tied = score.flatMap((s, i) => (s === best ? [i] : []));
	return tied[Math.floor(Math.random() * tied.length)]!;
}

it("hides the real face from anyone who counts which values are most common", () =>
{
	const found = LEVELS.map((L) =>
	{
		let hits = 0;
		for (let i = 0; i < LINEUPS; i++) if (mostTypical(lineup(L)) === 0) hits++;
		return hits / LINEUPS - 1 / cfg(L).choices < MAX_EDGE;
	});
	expect(found).toStrictEqual(LEVELS.map(() => true));
});

it("keeps every two faces in a lineup the level's number of features apart", () =>
{
	const wrong = LEVELS.flatMap((L) =>
		Array.from(
			{
				length: 200,
			},
			() => lineup(L),
		).flatMap((faces) =>
		{
			const c = cfg(L);
			const close = faces.flatMap((a, i) =>
				faces
					.slice(i + 1)
					.filter((b) => diffKeys(a, b).length < c.changes)
					.map(() => `level ${L} too close`),
			);
			return faces.length === c.choices ? close : [`level ${L} has ${faces.length} faces`];
		}),
	);
	expect([...new Set(wrong)]).toStrictEqual([]);
});

const BASE =
{
	...Object.fromEntries(KEYS.map((k) => [k, 0])),
	hairStyle: 3,
} as Face;
const RED = 0;
const BLUE = 1;
const RED_HAIR = 3;
const BLUE_DYE = 1;
const CAP = 1;

it("never puts a hat on hair of nearly the same color", () =>
{
	expect(
		{
			redCapOnRedHair: valid(
				{
					...BASE,
					hat: CAP,
					hatColor: RED,
					hairColor: RED_HAIR,
				},
			),
			blueCapOnBlueDye: valid(
				{
					...BASE,
					hat: CAP,
					hatColor: BLUE,
					hairDye: BLUE_DYE,
				},
			),
			redCapOnBlackHair: valid(
				{
					...BASE,
					hat: CAP,
					hatColor: RED,
				},
			),
			blueCapOnRedHair: valid(
				{
					...BASE,
					hat: CAP,
					hatColor: BLUE,
					hairColor: RED_HAIR,
				},
			),
			redHairBare: valid(
				{
					...BASE,
					hatColor: RED,
					hairColor: RED_HAIR,
				},
			),
		},
	).toStrictEqual(
		{
			redCapOnRedHair: false,
			blueCapOnBlueDye: false,
			redCapOnBlackHair: true,
			blueCapOnRedHair: true,
			redHairBare: true,
		},
	);
});
