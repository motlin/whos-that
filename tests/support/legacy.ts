import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import type {LevelConfig} from "../../src/game/difficulty.ts";
import type {FaceOptions} from "../../src/game/draw.ts";
import type {Face, FeatureKey} from "../../src/game/faces.ts";

export const LEGACY_PATH = new URL("../../legacy/original.html", import.meta.url);
export const legacySource = (): string => readFileSync(LEGACY_PATH, "utf8");

// A small seeded generator, so the original script and the port can be fed the same random numbers.
export function seeded(seed: number): () => number
{
	let a = seed >>> 0;
	return () =>
	{
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface LegacyCore
{
	setRandom: (random: () => number) => void;
	randomFace: () => Face;
	makeDecoy: (t: Face, n: number, pool: readonly FeatureKey[], used: Set<string>) => Face;
	visKey: (f: Face) => string;
	diffKeys: (a: Face, b: Face) => FeatureKey[];
	faceSVG: (f: Face, o?: FaceOptions) => string;
	cropBox: (f: Face, k: FeatureKey) => string | null;
	cfg: (L: number) => LevelConfig;
	buildCount: (L: number) => number;
	buildMem: (L: number) => number;
	buildOpts: (L: number) => number;
	stage: (L: number) => number;
	KEYS: FeatureKey[];
}

// Bugs fixed in the port since the original, applied to the original's source so the comparison checks everything else.
const FIXES: [string, string][] = [
	[
		"function visible(f,k){\n",
		"function visible(f,k){\n if(k==='earrings'&&f.hairStyle===9) return false;\n if(k==='ears'&&f.hairStyle===9&&f.ears!==3&&f.ears!==4) return false;\n",
	],
];

function applyFixes(html: string): string
{
	return FIXES.reduce((src, [from, to]) =>
	{
		if (!src.includes(from)) throw new Error(`legacy/original.html no longer contains ${JSON.stringify(from)}`);
		return src.replace(from, to);
	}, html);
}

// Runs the original script's pure part, from its helpers through the drawing code, and hands back its functions.
export function loadLegacyCore(): LegacyCore
{
	const html = applyFixes(legacySource());
	const start = html.indexOf("'use strict';");
	const end = html.indexOf("/* ---------- sound ---------- */");
	if (start < 0 || end < 0) throw new Error("legacy/original.html no longer has the expected sections");
	const code = `${html.slice(start, end)}
;({setRandom(r){Math.random=r},randomFace,makeDecoy,visKey,diffKeys,faceSVG,cropBox,cfg,buildCount,buildMem,buildOpts,stage,KEYS})`;
	return runInNewContext(code, {}) as LegacyCore;
}
