import type {Face, FeatureKey} from "./faces.ts";

// The features each stage adds to the ones before it, big and bold first, small and fine last.
const ADDED: FeatureKey[][] = [
	["hat", "glasses", "hairStyle", "hairColor", "hairDye", "facialHair", "shirt", "neckwear"],
	["shirtStyle", "eyes", "eyebrows", "skin"],
	// Noses, mouths, ears and cheeks are small or fine lines, so they wait for the next stage.
	["mouth", "nose", "ears", "cheeks", "faceShape", "hatColor"],
	["eyeColor", "earrings"],
];
const POOLS = ADDED.map((_, i) => ADDED.slice(0, i + 1).flat());
export const stage = (L: number): number => (L <= 4 ? 0 : L <= 6 ? 1 : L <= 8 ? 2 : 3);
// Every feature is in play and there are the most choices from this level, and only then does the time to memorize
// shrink, a second every few levels.
const FULL = 12;
const MEM_STEP = 3;

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
		mem: L <= FULL ? 10 : Math.max(5, 9 - Math.floor((L - FULL - 1) / MEM_STEP)),
		choices: Math.min(8, 3 + Math.floor((L - 1) / 2)),
		changes: L <= 4 ? 3 : L <= 8 ? 2 : 1,
		pool: POOLS[stage(L)]!,
		pick: Math.max(6, 20 - (L - 1)),
	};
}

export const BUILD_ALL: FeatureKey[] = [
	"faceShape",
	"skin",
	"hairStyle",
	"hairColor",
	"hairDye",
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
	"shirtStyle",
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
	hairStyle: 8,
	hairColor: 1,
	hairDye: 0,
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
	shirtStyle: 0,
};
export const buildCount = (L: number): number => Math.min(BUILD_ALL.length, 2 + L);
const buildFullAt = BUILD_ALL.length - 2;
export const buildMem = (L: number): number =>
	L <= buildFullAt
		? Math.round(5 + buildCount(L) * 1.2)
		: Math.max(10, Math.round(5 + BUILD_ALL.length * 1.2) - 2 * (L - buildFullAt));
export const buildOpts = (L: number): number => Math.min(6, 3 + Math.floor((L - 1) / 4));
