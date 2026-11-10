import type {Face, FeatureKey} from "./faces.ts";

const POOLS: FeatureKey[][] = [
	["hat", "glasses", "hairStyle", "hairColor", "facialHair", "shirt", "neckwear"],
	[
		"hat",
		"glasses",
		"hairStyle",
		"hairColor",
		"facialHair",
		"shirt",
		"neckwear",
		"mouth",
		"nose",
		"eyes",
		"ears",
		"cheeks",
		"eyebrows",
		"skin",
	],
	[
		"mouth",
		"nose",
		"eyes",
		"ears",
		"cheeks",
		"eyebrows",
		"faceShape",
		"skin",
		"hatColor",
		"neckwear",
		"glasses",
		"hairStyle",
	],
	["mouth", "nose", "eyes", "ears", "cheeks", "eyebrows", "faceShape", "hatColor", "eyeColor", "earrings"],
	["eyeColor", "earrings", "eyebrows", "nose", "ears", "cheeks", "hatColor", "mouth"],
];
export const stage = (L: number): number => (L <= 3 ? 0 : L <= 6 ? 1 : L <= 10 ? 2 : L <= 14 ? 3 : 4);

export interface LevelConfig
{
	mem: number;
	choices: number;
	changes: number;
	pool: FeatureKey[];
	pick: number;
}

export function cfg(L: number): LevelConfig
{
	return {
		mem: Math.max(5, 10 - Math.floor((L - 1) / 3)),
		choices: Math.min(8, 3 + Math.floor((L - 1) / 3)),
		changes: L <= 3 ? 3 : L <= 7 ? 2 : 1,
		pool: POOLS[stage(L)]!,
		pick: Math.max(6, 20 - (L - 1)),
	};
}

export const BUILD_ALL: FeatureKey[] = [
	"faceShape",
	"skin",
	"hairStyle",
	"hairColor",
	"eyebrows",
	"eyes",
	"eyeColor",
	"nose",
	"mouth",
	"ears",
	"facialHair",
	"glasses",
	"hat",
	"cheeks",
	"earrings",
	"neckwear",
	"shirt",
];
export const BUILD_EASY: FeatureKey[] = [
	"hairStyle",
	"hairColor",
	"hat",
	"glasses",
	"facialHair",
	"shirt",
	"mouth",
	"eyes",
	"nose",
	"neckwear",
	"cheeks",
];
export const PLAIN: Face =
{
	faceShape: 0,
	skin: 1,
	hairStyle: 1,
	hairColor: 1,
	eyebrows: 0,
	eyes: 0,
	eyeColor: 0,
	nose: 0,
	mouth: 0,
	ears: 0,
	facialHair: 0,
	glasses: 0,
	hat: 0,
	hatColor: 0,
	cheeks: 0,
	earrings: 0,
	neckwear: 0,
	shirt: 1,
};
export const buildCount = (L: number): number => Math.min(BUILD_ALL.length, 2 + L);
const buildFullAt = BUILD_ALL.length - 2;
export const buildMem = (L: number): number =>
	L <= buildFullAt
		? Math.round(5 + buildCount(L) * 1.2)
		: Math.max(10, Math.round(5 + BUILD_ALL.length * 1.2) - 2 * (L - buildFullAt));
export const buildOpts = (L: number): number => Math.min(6, 3 + Math.floor((L - 1) / 4));
