import {sketch} from "./sketch.ts";
import type {ArtStyle} from "./style.ts";

// Placeholder: draws the notebook sketch until this style has its own drawing.
export const paper: ArtStyle =
{
	...sketch,
	id: "paper",
	name: "Cut Paper",
	blurb: "Scissor-cut construction paper with shadows.",
};
