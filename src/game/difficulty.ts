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
// shrink, a second every few levels. The time to answer shrinks from the start, but more slowly.
const FULL = 12;
const MEM_STEP = 6;
const PICK_STEP = 3;
// The most time to memorize and to answer, and the least the hardest levels come down to.
const MEM = 12;
const MIN_MEM = 7;
const PICK = 22;
const MIN_PICK = 10;
// Six faces is the most a phone shows at a size where small features still read.
const MAX_CHOICES = 6;

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
		mem: Math.max(MIN_MEM, MEM - Math.floor(Math.max(0, L - FULL) / MEM_STEP)),
		choices: Math.min(MAX_CHOICES, 3 + Math.floor((L - 1) / 2)),
		changes: L <= 4 ? 3 : L <= 8 ? 2 : 1,
		pool: POOLS[stage(L)]!,
		pick: Math.max(MIN_PICK, PICK - Math.floor((L - 1) / PICK_STEP)),
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
