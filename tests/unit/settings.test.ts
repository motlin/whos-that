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

beforeEach(() =>
{
	stored = {};
	root =
	{
		dataset: {},
	};
	injected = [];
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

it("starts in the saved art style, and in the notebook sketch when nothing valid is saved", () =>
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
			invalid: ["sketch", "sketch"],
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
			drawn: true,
		},
	);
});
