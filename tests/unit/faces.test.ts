import {expect, it} from "vite-plus/test";
import {cfg} from "../../src/game/difficulty.ts";
import {diffKeys, type Face, FEMALE, KEYS, makeLineup, MALE, randomFace, valid, visKey} from "../../src/game/faces.ts";

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

const FACES = 40000;
const within = (x: number, lo: number, hi: number): boolean => x > lo && x < hi;
const share = (faces: Face[], test: (f: Face) => boolean): number => faces.filter(test).length / faces.length;
// Haircuts mostly worn by men or by women: bald, spiky, mohawk, balding and flat-top; long, ponytail, buns and pigtails.
const MENS_CUTS = new Set([0, 1, 6, 9, 12]);
const WOMENS_CUTS = new Set([3, 5, 7, 11]);

it("draws violet eyes and red hair rarely", () =>
{
	const faces = Array.from(
		{
			length: FACES,
		},
		() => randomFace(),
	);
	const rare =
	{
		violetEyes: share(faces, (f) => f.eyeColor === 4),
		redHair: share(faces, (f) => f.hairColor === 3),
	};
	expect(
		{
			violetEyes: rare.violetEyes > 0.01 && rare.violetEyes < 0.05,
			redHair: rare.redHair > 0.03 && rare.redHair < 0.08,
		},
	).toStrictEqual(
		{
			violetEyes: true,
			redHair: true,
		},
	);
});

it("gives women and men mostly their own haircuts, facial hair and earrings", () =>
{
	const women = Array.from(
		{
			length: FACES / 2,
		},
		() => randomFace(FEMALE),
	);
	const men = Array.from(
		{
			length: FACES / 2,
		},
		() => randomFace(MALE),
	);
	expect(
		{
			gender: [women[0]!.gender, men[0]!.gender],
			womenInMensCuts: within(
				share(women, (f) => MENS_CUTS.has(f.hairStyle)),
				0.08,
				0.18,
			),
			menInWomensCuts: within(
				share(men, (f) => WOMENS_CUTS.has(f.hairStyle)),
				0.08,
				0.18,
			),
			womenWithFacialHair: within(
				share(women, (f) => f.facialHair > 0),
				0.03,
				0.08,
			),
			menWithFacialHair: within(
				share(men, (f) => f.facialHair > 0),
				0.4,
				0.8,
			),
			womenWithEarrings: within(
				share(women, (f) => f.earrings > 0),
				0.5,
				0.9,
			),
			menWithEarrings: within(
				share(men, (f) => f.earrings > 0),
				0.1,
				0.3,
			),
		},
	).toStrictEqual(
		{
			gender: [FEMALE, MALE],
			womenInMensCuts: true,
			menInWomensCuts: true,
			womenWithFacialHair: true,
			menWithFacialHair: true,
			womenWithEarrings: true,
			menWithEarrings: true,
		},
	);
});

// A clean-shaven woman's only other choice is a beard, which would mark the face as a fake.
it("never asks about a feature nearly every face of that gender shares", () =>
{
	const c = cfg(15);
	const asked = Array.from(
		{
			length: 2000,
		},
		() =>
		{
			const t = randomFace(FEMALE);
			return makeLineup(t, c.choices, c.changes, c.pool, new Set([visKey(t)])).some(
				(d) => d.facialHair !== t.facialHair,
			);
		},
	);
	expect(asked.filter(Boolean).length).toBe(0);
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
