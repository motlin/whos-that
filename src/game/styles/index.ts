import {clay} from "./clay.ts";
import {paper} from "./paper.ts";
import {pixel} from "./pixel.ts";
import {sketch} from "./sketch.ts";
import {storybook} from "./storybook.ts";
import {DEFAULT_STYLE} from "./pages.ts";
import type {ArtStyle, StyleId} from "./style.ts";

export {DEFAULT_STYLE} from "./pages.ts";

export const STYLES: readonly ArtStyle[] = [storybook, paper, pixel, clay, sketch];
export const isStyleId = (id: unknown): id is StyleId => STYLES.some((s) => s.id === id);
export const styleOf = (id: StyleId): ArtStyle => STYLES.find((s) => s.id === id)!;

let current = styleOf(DEFAULT_STYLE);
export const currentStyle = (): ArtStyle => current;
export function setStyle(id: StyleId): void
{
	current = styleOf(id);
}
