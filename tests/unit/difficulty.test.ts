import {expect, it} from "vite-plus/test";
import {cfg} from "../../src/game/difficulty.ts";
import type {FeatureKey} from "../../src/game/faces.ts";

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
