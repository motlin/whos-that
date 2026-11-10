import {DEFAULT_STYLE, isStyleId, STYLES, setStyle} from "./styles/index.ts";
import type {StyleId} from "./styles/style.ts";
import {ls} from "./util.ts";

const STYLE_KEY = "wt_style";

// Switches the drawing and the page's theme, which game.css and themes.css key off the root's data-style.
function apply(id: StyleId): void
{
	setStyle(id);
	document.documentElement.dataset["style"] = id;
}

// Puts every style's filters on the page once, and starts in the style the player last chose.
export function initStyle(): void
{
	document.body.insertAdjacentHTML(
		"afterbegin",
		`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${STYLES.map((s) => s.defs).join("")}</defs></svg>`,
	);
	const saved = ls.get(STYLE_KEY);
	apply(isStyleId(saved) ? saved : DEFAULT_STYLE);
}

export function chooseStyle(id: StyleId): void
{
	apply(id);
	ls.set(STYLE_KEY, id);
}
