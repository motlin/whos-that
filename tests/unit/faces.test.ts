import {describe, expect, it} from "vite-plus/test";
import {diffKeys, type Face, makeDecoy, visKey} from "../../src/game/faces.ts";

const CURLY: Face =
{
	faceShape: 0,
	skin: 0,
	hairStyle: 9,
	hairColor: 2,
	eyebrows: 0,
	eyes: 0,
	eyeColor: 0,
	nose: 0,
	mouth: 0,
	ears: 0,
	facialHair: 0,
	glasses: 0,
	hat: 0,
	hatColor: 0,
	cheeks: 0,
	earrings: 0,
	neckwear: 0,
	shirt: 0,
};

describe("features hidden under curly hair", () =>
{
	it("does not count differences the curls cover", () =>
	{
		expect([
			diffKeys(
				CURLY,
				{
					...CURLY,
					earrings: 1,
				},
			),
			diffKeys(
				{
					...CURLY,
					ears: 3,
					earrings: 2,
				},
				{
					...CURLY,
					ears: 3,
				},
			),
			diffKeys(
				CURLY,
				{
					...CURLY,
					ears: 2,
				},
			),
			diffKeys(
				CURLY,
				{
					...CURLY,
					ears: 3,
				},
			),
			diffKeys(
				{
					...CURLY,
					ears: 3,
				},
				{
					...CURLY,
					ears: 4,
				},
			),
		]).toStrictEqual([[], [], [], [], ["ears"]]);
	});

	it("never makes a decoy whose only change is under the curls", () =>
	{
		for (let i = 0; i < 50; i++)
		{
			const used = new Set([visKey(CURLY)]);
			const decoy = makeDecoy(CURLY, 1, ["earrings", "nose"], used);
			expect(diffKeys(CURLY, decoy)).toStrictEqual(["nose"]);
		}
	});
});
