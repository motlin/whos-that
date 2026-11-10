import {sketch} from "./sketch.ts";
import type {ArtStyle} from "./style.ts";

// Placeholder: draws the notebook sketch until this style has its own drawing.
export const pixel: ArtStyle =
{
	...sketch,
	id: "pixel",
	name: "Pixel Arcade",
	blurb: "Chunky pixels from a late-night arcade.",
};
