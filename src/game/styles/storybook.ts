import {sketch} from "./sketch.ts";
import type {ArtStyle} from "./style.ts";

// Placeholder: draws the notebook sketch until this style has its own drawing.
export const storybook: ArtStyle =
{
	...sketch,
	id: "storybook",
	name: "Storybook",
	blurb: "A richer hand-drawn look with shading.",
};
