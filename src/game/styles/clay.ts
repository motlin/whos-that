import {sketch} from "./sketch.ts";
import type {ArtStyle} from "./style.ts";

// Placeholder: draws the notebook sketch until this style has its own drawing.
export const clay: ArtStyle =
{
	...sketch,
	id: "clay",
	name: "Modelling Clay",
	blurb: "Soft, rounded clay lit from the top left.",
};
