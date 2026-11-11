import {expect, it} from "vite-plus/test";
import {faceSVG, featureBox} from "../../src/game/draw.ts";
import {styleOf} from "../../src/game/styles/index.ts";
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
			hat: "-4.0 -85.0 208.0 208.0",
			eyes: "41.0 48.8 118.0 118.0",
			earrings: "9.0 32.8 182.0 182.0",
			oneEarring: "0.0 87.8 72.0 72.0",
			shirt: "6.0 146.0 188.0 188.0",
			shirtStyle: "6.0 146.0 188.0 188.0",
			skin: "4.0 24.0 192.0 192.0",
		},
	);
});

// Every paper layer runs its own grain and shadow filter, and a lineup draws many faces, so features that sit side by
// side on the face share one layer. Only the darkest skins add one: the lighter piece the brows are glued onto.
function paperLayers(skin: number): number
{
	return (
		faceSVG(
			{
				...Object.fromEntries(KEYS.map((k) => [k, 0])),
				skin,
			} as Face,
			{},
			styleOf("paper"),
		).split('filter="url(#paper-cut)"').length - 1
	);
}

it("draws a plain Cut Paper face in seven paper layers, and eight on the darkest skins", () =>
{
	expect([paperLayers(0), paperLayers(4)]).toStrictEqual([7, 8]);
});
