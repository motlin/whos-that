export const MODE_IDS = ["classic", "spot", "build", "lineup"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export interface ScoreEntry
{
	n: string;
	s: number;
	l: number;
	t: number;
}
export type Boards = Record<ModeId, ScoreEntry[]>;

const isModeId = (value: unknown): value is ModeId => (MODE_IDS as readonly unknown[]).includes(value);

export function emptyBoards(): Boards
{
	return {
		classic: [],
		spot: [],
		build: [],
		lineup: [],
	};
}

// Ranks the way the game always has: higher score first, and the earlier of two equal scores first.
export function sortTop(boards: Boards): Boards
{
	for (const id of MODE_IDS) boards[id] = boards[id].toSorted((a, b) => b.s - a.s || a.t - b.t).slice(0, 10);
	return boards;
}

// The game's award(): a cleared level L is worth 100 + 10*(L-1), plus up to 100 more for the fraction of the answer time
// left and up to 100 more for the fraction of the memorize time left when the player tapped ready. Both fractions come
// from the millisecond clock, and the total is rounded once.
export const levelPoints = (level: number, answer: number, memorize: number): number =>
	100 + 10 * (level - 1) + Math.round(100 * (answer + memorize));

// The game submits G.level at game over, and G.level moves past a level only once it is cleared, so a score at level l
// holds one award for each of levels 1 to l - 1. Summing levelPoints(L, frac, frac) over those levels gives
// 100c + 5c(c - 1) with no time left (frac = 0) and 300c + 5c(c - 1) with all of it (frac = 1), where c = l - 1.
const cleared = (level: number): number => Math.max(0, level - 1);
export const minScoreForLevel = (level: number): number =>
	100 * cleared(level) + 5 * cleared(level) * (cleared(level) - 1);
export const maxScoreForLevel = (level: number): number =>
	300 * cleared(level) + 5 * cleared(level) * (cleared(level) - 1);

const NAME_MAX = 12;
const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;
// oxlint-disable-next-line no-control-regex -- matching control characters is the point.
const CONTROL = /[\u0000-\u001f\u007f]/;

export interface Submission
{
	mode: ModeId;
	name: string;
	score: number;
	level: number;
	deviceId: string;
}
export type Validation =
	|
	  {
			ok: true;
			value: Submission;
	  }
	|
	  {
			ok: false;
			error: string;
	  };

function fail(error: string): Validation
{
	return {
		ok: false,
		error,
	};
}

export function validateSubmission(body: unknown): Validation
{
	if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("body must be a JSON object");
	const field = (key: string): unknown => Reflect.get(body, key);
	const mode = field("mode"),
		name = field("name"),
		score = field("score"),
		level = field("level"),
		deviceId = field("deviceId");
	if (!isModeId(mode)) return fail(`mode must be one of ${MODE_IDS.join(", ")}`);
	const trimmed = typeof name === "string" ? name.trim() : "";
	if (trimmed.length < 1 || trimmed.length > NAME_MAX) return fail(`name must be 1 to ${NAME_MAX} characters`);
	if (CONTROL.test(trimmed)) return fail("name must not contain control characters");
	if (typeof level !== "number" || !Number.isSafeInteger(level) || level < 1)
		return fail("level must be an integer of at least 1");
	if (typeof score !== "number" || !Number.isSafeInteger(score)) return fail("score must be a whole number");
	if (score < minScoreForLevel(level) || score > maxScoreForLevel(level))
		return fail(`score is not possible at level ${level}`);
	if (typeof deviceId !== "string" || !DEVICE_ID.test(deviceId))
		return fail("deviceId must be 8 to 64 letters, digits, - or _");
	return {
		ok: true,
		value:
		{
			mode,
			name: trimmed,
			score,
			level,
			deviceId,
		},
	};
}
