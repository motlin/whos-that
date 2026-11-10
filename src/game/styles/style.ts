import type {Face} from "../faces.ts";

export type StyleId = "sketch" | "storybook" | "paper" | "pixel" | "clay";

// One way of drawing a face. Every style draws in the shared card coordinates of geometry.ts and puts each feature
// where geo() and regions() say it is, so the game can crop, highlight and mark any style the same way.
export interface ArtStyle
{
	id: StyleId;
	name: string;
	blurb: string;
	// Filters and patterns the drawing refers to by id, as the inside of an SVG <defs>.
	defs: string;
	// The drawing itself, without the <svg> wrapper.
	paint(f: Face): string;
}
