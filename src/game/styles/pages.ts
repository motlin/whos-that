import type {StyleId} from "./style.ts";

// Each style's page color, the --paper its theme sets in game.css or themes.css. The browser's toolbar, the installed
// app's splash screen and the icons' board take it too. This module draws nothing, so the manifest can read it without
// pulling in the painters.
export const PAGE_COLOR: Record<StyleId, string> =
{
	sketch: "#fffdf6",
	storybook: "#fbf1df",
	paper: "#1f6f6b",
	pixel: "#171430",
	clay: "#e6e4ff",
};

export const DEFAULT_STYLE: StyleId = "paper";
