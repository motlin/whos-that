import {expect, it} from "vite-plus/test";
import {featureBox} from "../../src/game/draw.ts";
import {type Face, KEYS} from "../../src/game/faces.ts";

const FACE = Object.fromEntries(KEYS.map((k) => [k, 0])) as Face;

it("crops a face to any group of features, including the ones build mode shows whole", () =>
{
	expect(
		{
			hat: featureBox(FACE, ["hat", "hatColor"]),
			eyes: featureBox(FACE, ["eyes", "eyeColor"]),
			earrings: featureBox(FACE, ["earrings"]),
			oneEarring: featureBox(FACE, ["earrings"], true),
			shirt: featureBox(FACE, ["shirt"]),
			shirtStyle: featureBox(FACE, ["shirtStyle"]),
			skin: featureBox(FACE, ["skin"]),
		},
	).toStrictEqual(
		{
			hat: "6.0 -64.0 188.0 188.0",
			eyes: "41.0 48.8 118.0 118.0",
			earrings: "9.0 32.8 182.0 182.0",
			oneEarring: "0.0 87.8 72.0 72.0",
			shirt: "6.0 146.0 188.0 188.0",
			shirtStyle: "6.0 146.0 188.0 188.0",
			skin: "4.0 24.0 192.0 192.0",
		},
	);
});
