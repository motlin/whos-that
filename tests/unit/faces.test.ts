import {expect, it} from "vite-plus/test";
import {type Face, KEYS, valid} from "../../src/game/faces.ts";

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
