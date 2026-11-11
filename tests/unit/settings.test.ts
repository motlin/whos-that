import {afterEach, beforeEach, expect, it, vi} from "vite-plus/test";
import {faceSVG} from "../../src/game/draw.ts";
import {PLAIN} from "../../src/game/difficulty.ts";
import {chooseStyle, initStyle} from "../../src/game/settings.ts";
import {currentStyle, STYLES} from "../../src/game/styles/index.ts";

let stored: Record<string, string>;
let root:
{
	dataset: Record<string, string>;
};
let injected: string[];
let themeColor: Record<string, string>;

beforeEach(() =>
{
	stored = {};
	root =
	{
		dataset: {},
	};
	injected = [];
	themeColor = {};
	vi.stubGlobal(
		"localStorage",
		{
			getItem: (k: string): string | null => stored[k] ?? null,
			setItem: (k: string, v: string): void =>
			{
				stored[k] = v;
			},
		},
	);
	vi.stubGlobal(
		"document",
		{
			documentElement: root,
			querySelector: (selector: string) =>
				selector === 'meta[name="theme-color"]'
					?
						{
							setAttribute: (name: string, value: string): void =>
							{
								themeColor[name] = value;
							},
						}
					: null,
			body:
			{
				insertAdjacentHTML: (_where: string, html: string): void =>
				{
					injected.push(html);
				},
			},
		},
	);
});

afterEach(() =>
{
	vi.unstubAllGlobals();
});

it("starts in the saved art style, and in cut paper when nothing valid is saved", () =>
{
	stored["wt_style"] = "pixel";
	initStyle();
	const saved = [currentStyle().id, root.dataset["style"]];
	stored["wt_style"] = "crayon";
	initStyle();
	expect(
		{
			saved,
			invalid: [currentStyle().id, root.dataset["style"]],
			defs: injected.map((html) => html.startsWith("<svg") && STYLES.every((s) => html.includes(s.defs))),
		},
	).toStrictEqual(
		{
			saved: ["pixel", "pixel"],
			invalid: ["paper", "paper"],
			defs: [true, true],
		},
	);
});

it("keeps a chosen art style and draws every face in it from then on", () =>
{
	initStyle();
	chooseStyle("clay");
	expect(
		{
			stored,
			current: currentStyle().id,
			theme: root.dataset["style"],
			toolbar: themeColor,
			drawn:
				faceSVG(PLAIN) ===
				faceSVG(
					PLAIN,
					{},
					STYLES.find((s) => s.id === "clay"),
				),
		},
	).toStrictEqual(
		{
			stored:
			{
				wt_style: "clay",
			},
			current: "clay",
			theme: "clay",
			// The browser's toolbar takes the clay page's color.
			toolbar:
			{
				content: "#e6e4ff",
			},
			drawn: true,
		},
	);
});
