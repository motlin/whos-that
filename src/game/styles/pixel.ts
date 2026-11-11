import {CLOTH, DYEC, EYEC, type Face, HAIRC, HATC, SKIN} from "../faces.ts";
import {geo, type Geo, headHalf, shade, solve, VB} from "../geometry.ts";
import type {ArtStyle} from "./style.ts";

// The card is a grid of square cells laid over the shared viewBox. The middle of the face, x = 100, is a cell boundary,
// so everything mirrors cleanly. A drawing fills cells from the back to the front; the last tone written wins.
const CELL = 4;
const X0 = VB[0]!;
const Y0 = VB[1]!;
const COLS = VB[2]! / CELL;
const ROWS = Math.ceil(VB[3]! / CELL);
const MID = (100 - X0) / CELL;
const OUTLINE = "#1a1626";
const FRAME = "#23202e";
const GOLD = "#e6b422";
const GOLD_DARK = "#a3730c";
// Dark lines vanish on the two darkest skins, so whatever is drawn on the skin there uses a warm light tone instead.
const LINE = ["#9c6247", "#8a5230", "#5a3115", "#e8bd92", "#c9905f"];
// Shading on the skin is a warmer, darker skin tone rather than a grey.
const SHADOW = ["#f0c4a2", "#d49a62", "#a2663a", "#673c1f", "#331c0f"];
const LIP = ["#7a2f2f", "#6e2a24", "#4a1c14", "#f0c7a0", "#d69a6a"];

type Tone = string | null;
type Test = (X: number, Y: number) => boolean;
type Inks = Record<string, string>;
type Points = readonly (readonly [number, number])[];

// One face being drawn: its cells, its colors, and where its features snap to the grid.
interface Art
{
	f: Face;
	g: Geo;
	px: Tone[];
	sk: string;
	line: string;
	// The tones that count as bare skin, so hair knows where it borders the face.
	skins: Set<string>;
	// Natural hair color, for eyebrows and facial hair, and the color on the head, which a dye replaces.
	natural: string;
	hair: string;
	// The cell at the centre of the right eye, and the cell boundaries of the nose and mouth lines.
	eyeCol: number;
	eyeRow: number;
	noseRow: number;
	mouthRow: number;
	head(X: number, Y: number, grow?: number): boolean;
	// Where head hair may go: a hat that sits over the crown keeps every lock above its bottom edge close to the head.
	room: Test;
}

const cellX = (x: number): number => X0 + (x + 0.5) * CELL;
const cellY = (y: number): number => Y0 + (y + 0.5) * CELL;
// The cell a cell centre belongs to, and how far a point is from the middle of the face.
const cellCol = (X: number): number => (X - X0) / CELL - 0.5;
const cellRow = (Y: number): number => (Y - Y0) / CELL - 0.5;
const off = (X: number): number => Math.abs(X - 100);
// A number that scatters specks over the cells of a mass of hair.
const scatter = (X: number, Y: number): number => cellCol(X) * 7 + cellRow(Y) * 3;
// The cell boundary nearest a card coordinate.
const col = (X: number): number => Math.round((X - X0) / CELL);
const row = (Y: number): number => Math.round((Y - Y0) / CELL);
const oval = (X: number, Y: number, cx: number, cy: number, rx: number, ry: number): boolean =>
	((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1;
// A wave that is 0 at even numbers and 1 at odd ones.
const tri = (v: number): number => 1 - Math.abs((((v % 2) + 2) % 2) - 1);
const luma = (hex: string): number =>
{
	const n = parseInt(hex.slice(1), 16);
	return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
const mix = (a: string, b: string, p: number): string =>
{
	const [m, n] = [parseInt(a.slice(1), 16), parseInt(b.slice(1), 16)];
	const c = [16, 8, 0].map((s) => Math.round(((m >> s) & 255) * (1 - p) + ((n >> s) & 255) * p));
	return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

// The value at v of the line drawn through the points, flat beyond either end.
function along(v: number, points: Points): number
{
	let [x0, y0] = points[0]!;
	if (v <= x0) return y0;
	for (const [x1, y1] of points.slice(1))
	{
		if (v <= x1) return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0);
		[x0, y0] = [x1, y1];
	}
	return y0;
}

// The top edge of the shirt, by distance from the middle: a scooped neckline, then the shoulders.
function shirtTop(dx: number): number
{
	if (dx > 88) return 999;
	if (dx <= 40)
	{
		const s = 1 - dx / 40;
		return 219 * (1 - s) ** 2 + 460 * s * (1 - s) + 230 * s * s;
	}
	const s = solve((v) => 40 * (1 - v) ** 2 + 168 * v * (1 - v) + 88 * v * v, dx);
	return 219 * (1 - s) ** 2 + 452 * s * (1 - s) + 254 * s * s;
}

function dot(px: Tone[], x: number, y: number, tone: string): void
{
	if (x >= 0 && x < COLS && y >= 0 && y < ROWS) px[y * COLS + x] = tone;
}

function box(px: Tone[], x: number, y: number, w: number, h: number, tone: string): void
{
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dot(px, x + i, y + j, tone);
}

// A box that starts dx cells right of the middle, and its mirror image on the left.
function both(px: Tone[], dx: number, y: number, w: number, h: number, tone: string): void
{
	box(px, MID + dx, y, w, h, tone);
	box(px, MID - dx - w, y, w, h, tone);
}

// Fills every cell whose centre passes the test.
function area(px: Tone[], test: Test, tone: string | ((X: number, Y: number) => string)): void
{
	for (let y = 0; y < ROWS; y++)
	{
		for (let x = 0; x < COLS; x++)
		{
			const X = cellX(x),
				Y = cellY(y);
			if (test(X, Y)) px[y * COLS + x] = typeof tone === "string" ? tone : tone(X, Y);
		}
	}
}

// Draws a small picture, one character per cell; characters without an ink are left alone.
function stamp(px: Tone[], left: number, top: number, rows: readonly string[], inks: Inks, flip = false): void
{
	for (const [j, line] of rows.entries())
	{
		for (let i = 0; i < line.length; i++)
		{
			const tone = inks[line[flip ? line.length - 1 - i : i]!];
			if (tone) dot(px, left + i, top + j, tone);
		}
	}
}

// Stamps a picture on the right of the face and its mirror image on the left.
function twin(px: Tone[], left: number, top: number, rows: readonly string[], inks: Inks): void
{
	stamp(px, left, top, rows, inks);
	stamp(px, 2 * MID - left - rows[0]!.length, top, rows, inks, true);
}

// The line that separates hair from skin: a darker shade of the hair, or the light face line when dark hair sits on
// dark skin.
const rimTone = (a: Art, base: string): string => (a.f.skin >= 3 && luma(base) < 110 ? a.line : shade(base, -0.3));

// Fills a mass of hair, drawing its rim wherever it borders bare skin.
function mass(a: Art, test: Test, base: string): void
{
	const rim = rimTone(a, base);
	const inside = a.px.map((_, i) =>
	{
		const [X, Y] = [cellX(i % COLS), cellY(Math.floor(i / COLS))];
		return test(X, Y) && a.room(X, Y);
	});
	for (const [i, on] of inside.entries())
	{
		if (!on) continue;
		const x = i % COLS;
		const near = [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS];
		a.px[i] = near.some((n) => inside[n] === false && a.skins.has(a.px[n] ?? "")) ? rim : base;
	}
}

// Recolors the cells of one tone that pass the test.
function tint(px: Tone[], from: string, test: Test, to: string): void
{
	area(px, (X, Y) => px[cellRow(Y) * COLS + cellCol(X)] === from && test(X, Y), to);
}

// A highlight one cell under the top edge of the hair, between two card x positions.
function gloss(a: Art, base: string, from: number, to: number): void
{
	for (let x = col(from); x < col(to); x++)
	{
		const top = Array.from(
			{
				length: ROWS,
			},
			(_, y) => y,
		).find((y) => a.px[y * COLS + x] === base);
		if (top !== undefined && a.px[(top + 1) * COLS + x] === base) dot(a.px, x, top + 1, shade(base, 0.3));
	}
}

// How far each hair style lifts a hat off the head.
const LIFT: Record<number, number> =
{
	1: 10,
	8: 8,
	2: 4,
	3: 4,
	12: 8,
	13: 4,
};
// The hats that sit over the whole crown of the head, rather than on a band or perched on top.
const CROWNED = new Set([1, 2, 3, 4, 7, 8, 9]);

// The bottom edge of the hat and its half width. An afro holds a hat up on top of the ball of hair.
function fit(
	f: Face,
	g: Geo,
):
{
	hy: number;
	hw: number;
}
{
	const afro = f.hairStyle === 4;
	return {
		hy: afro ? g.t + 44 - g.w : g.t + 16 - (LIFT[f.hairStyle] ?? 0),
		hw: g.w + (afro ? 24 : 7),
	};
}

function hairBack(a: Art): void
{
	const {w, t, ey, R} = a.g;
	switch (a.f.hairStyle)
	{
		case 2:
			// The bob hangs to the jaw, wider than the head, with rounded corners.
			mass(
				a,
				(X, Y) =>
				{
					const dx = off(X) - (w + 12 - 30),
						dy = Math.max(t + 22 - Y, Y - (ey + 48 - 12));
					if (dx > 30 || Y < t - 8 || Y > ey + 48) return false;
					return dx <= 0 || dy <= 0 || Math.hypot(dx, dy * (dy > 0 && Y > ey ? 2.5 : 1)) <= 30;
				},
				a.hair,
			);
			break;
		case 3:
			// Long hair falls behind the shoulders, a little wider the lower it goes.
			mass(
				a,
				(X, Y) =>
				{
					if (Y < t - 12 || Y > 238) return false;
					const half =
						Y < t + 34
							? (w + 15) * Math.sqrt(1 - ((t + 34 - Y) / 46) ** 2)
							: w + 15 + (8 * (Y - t - 34)) / (204 - t);
					return off(X) <= half;
				},
				a.hair,
			);
			break;
		case 4:
			// The afro is a big ball with a bumpy edge.
			mass(
				a,
				(X, Y) =>
				{
					const angle = Math.atan2(Y - t - 34, X - 100);
					return Math.hypot(X - 100, Y - t - 34) <= w + 23 + 9 * Math.abs(Math.cos(angle * 7));
				},
				a.hair,
			);
			break;
		case 5:
		{
			// The ponytail swings out to one side from a red tie.
			const [cx, cy] = [R + 18, t + 66];
			mass(
				a,
				(X, Y) =>
				{
					const u = (X - cx) * 0.927 + (Y - cy) * 0.375,
						v = (Y - cy) * 0.927 - (X - cx) * 0.375;
					return oval(u, v, 0, 0, 16 - Math.max(0, v) * 0.12, 42);
				},
				a.hair,
			);
			box(a.px, col(R + 4) - 1, row(t + 32) - 2, 3, 3, "#ff4d6d");
			dot(a.px, col(R + 4) - 1, row(t + 32) - 2, "#ff9cb0");
			break;
		}
		case 7:
		{
			// The buns sit at the sides of the head, below where a hat over the crown ends, so a hat never hides or moves them.
			const [bx, by, r] = [w + 6, t + 31, 18];
			mass(a, (X, Y) => oval(off(X), Y, bx, by, r, r), a.hair);
			tint(a.px, a.hair, (X, Y) => oval(off(X), Y, bx - r * 0.35, by - r * 0.45, 7, 5), shade(a.hair, 0.3));
			break;
		}
		case 11:
		{
			// Two braids hang beside the neck, each a chain of knots with a red tie at the end.
			mass(
				a,
				(X, Y) =>
				{
					const i = Math.min(4, Math.max(0, Math.round((Y - ey - 28) / 15)));
					return oval(off(X), Y, w + 9 + (i % 2 ? 2 : -2), ey + 28 + i * 15, 10, 10.5);
				},
				a.hair,
			);
			const dark = shade(a.hair, a.f.skin >= 3 && luma(a.hair) < 110 ? 0.3 : -0.3);
			for (let i = 0; i < 4; i++)
				tint(a.px, a.hair, (X, Y) => Math.abs(Y - (ey + 35.5 + i * 15)) < 2 && off(X) > w, dark);
			both(a.px, col(100 + w + 9) - MID - 2, row(ey + 99), 4, 2, "#ff4d6d");
			both(a.px, col(100 + w + 9) - MID - 1, row(ey + 99) + 2, 2, 2, a.hair);
			break;
		}
	}
	if (a.f.hairStyle === 4) curls(a, a.hair);
}

// Specks of light and shade that make a mass of hair read as curly.
function curls(a: Art, base: string): void
{
	tint(a.px, base, (X, Y) => scatter(X, Y) % 11 === 0, shade(base, 0.22));
	tint(a.px, base, (X, Y) => scatter(X, Y) % 11 === 5, shade(base, -0.25));
}

function hairFront(a: Art): void
{
	const {f, g, hair} = a;
	const {w, t, ey, L, R, cy, ry} = g;
	const fb = ey - 28;
	// A cap of hair over the head: so far out at the sides, and so far up at the top.
	const crown = (X: number, Y: number, side: number, top: number): boolean =>
		a.head(X, Y, side) || a.head(X, Y + top - side, side);
	const under =
		(edge: Points): Test =>
		(X, Y) =>
			Y < along(X, edge);
	const parted: Points = [
		[L - 3, ey - 8],
		[L + 5, fb],
		[93, fb - 6],
		[99, t + 6],
		[101, t + 6],
		[107, fb - 6],
		[R - 5, fb],
		[R + 3, ey - 8],
	];
	const shine = (dx: number): void =>
	{
		const light = shade(a.sk, f.skin >= 3 ? 0.3 : 0.6);
		box(a.px, col(100 - w * dx), row(t + 12), 4, 1, light);
		box(a.px, col(100 - w * dx) - 1, row(t + 12) + 1, 2, 1, light);
	};
	switch (f.hairStyle)
	{
		case 0:
			shine(0.5);
			return;
		case 1:
		{
			// Spikes fan out around the top of the head, over a zigzag fringe.
			const spiky = (X: number, Y: number): boolean =>
			{
				const turn = Math.atan2(cy - Y, X - 100) / Math.PI;
				const e = turn > 0.08 && turn < 0.92 ? 21 * tri(((turn - 0.08) / 0.84) * 12) : 0;
				return oval(X, Y, 100, cy, w + 3 + e, ry + 3 + e);
			};
			const fringe = (X: number): number =>
				off(X) > w - 4 ? ey - 12 : fb - 9 * tri((X - L - 4) / ((2 * w - 8) / 7));
			mass(a, (X, Y) => Y < fringe(X) && (crown(X, Y, 3, 5) || spiky(X, Y)), hair);
			break;
		}
		case 2:
			// The bob's fringe is a straight line; a lock hangs at each side of the face.
			mass(a, (X, Y) => crown(X, Y, 5, 8) && Y < (off(X) < w - 8 ? fb : ey - 4), hair);
			break;
		case 3:
			// Long hair parts off-centre and sweeps down past each temple.
			mass(
				a,
				(X, Y) =>
					crown(X, Y, 5, 12) &&
					under([
						[L + 5, ey + 6],
						[L + 12, fb + 2],
						[82, t + 12],
						[86, t + 12],
						[100, fb - 4],
						[R - 20, fb - 2],
						[R - 5, fb + 4],
						[R + 4, ey + 6],
					])(X, Y),
				hair,
			);
			break;
		case 4:
			mass(
				a,
				(X, Y) =>
					crown(X, Y, 3, 6) &&
					under([
						[L - 2, ey - 10],
						[L + 10, fb - 2],
						[100, fb - 8],
						[R - 10, fb - 2],
						[R + 2, ey - 10],
					])(X, Y),
				hair,
			);
			curls(a, hair);
			break;
		case 5:
			mass(
				a,
				(X, Y) =>
					crown(X, Y, 4, 8) &&
					under([
						[L - 3, ey - 8],
						[L + 3, fb + 3],
						[L + 14, fb],
						[100, fb - 9],
						[R - 14, fb],
						[R - 3, fb + 3],
						[R + 3, ey - 8],
					])(X, Y),
				hair,
			);
			break;
		case 6:
		{
			// The mohawk is a narrow crest of three spikes down the middle of a bare head.
			const tops = [t - 42, t - 28, t - 34, t - 14, t - 20];
			mass(
				a,
				(X, Y) =>
				{
					const i = Math.floor(off(X) / CELL);
					return i < 5 && Y > tops[i]! && Y < (i < 3 ? t + 26 : t + 16);
				},
				hair,
			);
			tint(a.px, hair, (X, Y) => X > 96 && X < 100 && Y < t - 4, shade(hair, 0.3));
			return;
		}
		case 7:
		case 11:
			// Buns and braids share a cap with a centre parting.
			mass(a, (X, Y) => crown(X, Y, 4, 8) && under(parted)(X, Y), hair);
			break;
		case 8:
		{
			// Short curls: a cap with a ring of round bumps that stops above the ears.
			const bumps = Array.from(
				{
					length: 11,
				},
				(_, i) =>
				{
					const turn = Math.PI * (1.15 + (i * 0.7) / 10);
					return [100 + (w + 5) * Math.cos(turn), cy + (ry + 5) * Math.sin(turn)] as const;
				},
			);
			mass(
				a,
				(X, Y) =>
					bumps.some(([bx, by]) => oval(X, Y, bx, by, 11.5, 11.5)) ||
					(crown(X, Y, 3, 7) &&
						under([
							[L - 2, ey - 10],
							[L + 6, fb],
							[100, fb - 6],
							[R - 6, fb],
							[R + 2, ey - 10],
						])(X, Y)),
				hair,
			);
			curls(a, hair);
			break;
		}
		case 9:
			// Balding: a tuft over each ear and a bare, shiny top.
			mass(
				a,
				(X, Y) =>
					Y > t + 12 &&
					Y < ey + 2 &&
					a.head(X, Y, 8) &&
					off(X) >
						along(Y, [
							[t + 12, w - 20],
							[t + 40, w - 10],
							[ey + 2, w - 10],
						]),
				hair,
			);
			shine(0.3);
			return;
		case 10:
			// A side part: low on one side of the parting, piled high and swept across the forehead on the other.
			mass(
				a,
				(X, Y) =>
					(crown(X, Y, 4, 7) || (X > L + 24 && a.head(X, Y + 22, 7))) &&
					under([
						[L - 3, ey - 8],
						[L + 10, fb - 4],
						[L + 22, t + 9],
						[L + 26, t + 9],
						[L + 42, fb - 10],
						[100, fb - 1],
						[R - 14, fb + 6],
						[R - 3, fb + 6],
						[R + 3, ey - 8],
					])(X, Y),
				hair,
			);
			tint(a.px, hair, (X, Y) => Math.abs(X - L - 24) < 2 && Y > t - 10, shade(hair, -0.3));
			gloss(a, hair, L + 30, R - 14);
			return;
		case 12:
			// A flat-top: straight sides and a level top.
			mass(
				a,
				(X, Y) =>
					Y > t - 24 &&
					off(X) < w + 6 &&
					under([
						[L - 6, ey - 8],
						[L + 4, fb + 1],
						[100, fb - 4],
						[R - 4, fb + 1],
						[R + 6, ey - 8],
					])(X, Y),
				hair,
			);
			break;
		case 13:
			// A bowl cut: a big round cap with a straight fringe just above the eyebrows.
			mass(a, (X, Y) => crown(X, Y, 8, 11) && Y < (off(X) < w - 6 ? fb + 6 : ey - 1), hair);
			tint(
				a.px,
				hair,
				(X, Y) => off(X) < w * 0.55 && Math.abs(Y - (t + 4 + ((X - 100) / w) ** 2 * 14)) < 2,
				shade(hair, 0.3),
			);
			return;
	}
	gloss(a, hair, 100 - w * 0.62, 100 - w * 0.12);
}

function ears(a: Art): void
{
	const {f, g, sk, px} = a;
	const x = g.w - 3,
		y = g.ey + 10;
	const side = (X: number): number => off(X) - x;
	switch (f.ears)
	{
		case 0:
			area(px, (X, Y) => oval(side(X), Y, 5, y, 10, 14), sk);
			area(px, (X, Y) => Math.abs(side(X) - 7) < 2 && Math.abs(Y - y) < 6, a.line);
			break;
		case 1:
			area(px, (X, Y) => oval(side(X), Y, 9, y, 15, 21), sk);
			area(px, (X, Y) => Math.abs(side(X) - 13) < 2 && Math.abs(Y - y) < 10, a.line);
			break;
		case 2:
			// A pointed ear: the tip sweeps up and out.
			area(
				px,
				(X, Y) =>
					Y > y - 32 &&
					side(X) >=
						along(Y, [
							[y - 32, 23],
							[y - 20, 13],
							[y - 10, 0],
						]) &&
					side(X) <=
						along(Y, [
							[y - 32, 26],
							[y - 8, 18],
							[y + 14, 8],
							[y + 18, 0],
						]),
				sk,
			);
			break;
		case 3:
			area(px, (X, Y) => oval(side(X), Y, 13, y - 1, 16, 11.5), sk);
			area(px, (X, Y) => oval(side(X), Y, 16, y - 1, 6, 4), a.line);
			break;
	}
	if (!f.earrings) return;
	const [dx, dy] = (
		[
			[5, 14],
			[9, 21],
			[8, 14],
			[14, 9],
		] as const
	)[f.ears]!;
	const cx = Math.floor((100 + x + dx - X0) / CELL),
		top = row(y + dy);
	switch (f.earrings)
	{
		case 1:
			twin(
				px,
				cx - 2,
				top,
				[".GGG.", "G...D", "G...D", "G...D", ".DDD."],
				{
					G: GOLD,
					D: GOLD_DARK,
				},
			);
			break;
		case 2:
			twin(
				px,
				cx - 1,
				top - 1,
				[".w.", ".B.", "HBB", "BBB", "BBD", ".D."],
				{
					w: "#8a8f98",
					B: "#35c4f0",
					H: "#c4f1ff",
					D: "#1f8fc0",
				},
			);
			break;
		case 3:
			twin(
				px,
				cx - 1,
				top,
				[".RR.", "RHRR", "RRRD", ".DD."],
				{
					R: "#e5484d",
					H: "#ffa3a6",
					D: "#a82a30",
				},
			);
			break;
		case 4:
			twin(
				px,
				cx - 2,
				top,
				["..G..", ".GGG.", ".GGG.", "GGGGG", "DDDDD"],
				{
					G: "#3fbf6f",
					D: "#27894a",
				},
			);
			break;
	}
}

function head(a: Art): void
{
	const {f, sk, px} = a;
	const edge = SHADOW[f.skin]!;
	a.skins.add(edge);
	area(
		px,
		(X, Y) => a.head(X, Y),
		(X, Y) => (a.head(X + CELL, Y) && a.head(X, Y + CELL) ? sk : edge),
	);
	// Where the chin crosses the neck there is skin on both sides, so on the darkest skins that stretch is the face line.
	if (f.skin >= 3) area(px, (X, Y) => off(X) < 16 && a.head(X, Y) && !a.head(X, Y + CELL), a.line);
}

const EYES: readonly (readonly [number, number, readonly string[]])[] = [
	[2, 2, [".KKK.", "WHIIW", "WIPIW", "WIIIW", ".WWW."]],
	[3, 3, [".KKKKK.", "WWIIIWW", "WIHIIIW", "WIIPIIW", "WIIIIIW", "WWIIIWW", ".WWWWW."]],
	// Sleepy: a heavy shaded lid comes halfway down over a round eye, leaving only the bottom of the iris.
	[3, 3, ["..LLL..", ".LLLLL.", "KKKKKKK", "WIIPIIW", ".WIIIW.", "..WWW.."]],
	// Almond: a long, narrow eye that tapers to a point at each end, with a flick at the outer corner.
	[3, 2, ["......K", ".KKKKK.", "WWIPIWW", ".WIIIW."]],
	[2, 4, [".K.K...", "KKKKKKK", "KKKKK..", "WHIIW..", "WIPIW..", "WIIIW..", ".WWW..."]],
	[3, 2, [".KKKKK.", "WWWWHII", "WWWWIPI", "WWWWIII", ".WWWWW."]],
];

function eyes(a: Art): void
{
	const [ox, oy, rows] = EYES[a.f.eyes]!;
	const inks =
	{
		K: OUTLINE,
		W: "#fff",
		H: "#fff",
		I: EYEC[a.f.eyeColor]!,
		P: "#111",
		// The lid is tinted toward the face line, so it shows as a lid on every skin.
		L: mix(a.sk, a.line, 0.4),
	};
	const left = MID + a.eyeCol - ox,
		top = a.eyeRow - oy;
	// Eyes that look sideways both look the same way; every other eye is mirrored.
	if (a.f.eyes === 5)
	{
		stamp(a.px, left, top, rows, inks);
		stamp(a.px, 2 * MID - left - rows[0]!.length, top, rows, inks);
	}
	else twin(a.px, left, top, rows, inks);
}

// Eyebrows as drawn over the right eye, inner end first. H is hair and R the rim under it.
const BROWS: readonly (readonly string[])[] = [
	[".HHHHH.", "HRRRRRH", "R.....R"],
	["HHHHHHH", "HHHHHHH", "RRRRRRR"],
	["....HHH", "..HHRRR", "HHRR...", "RR....."],
	["HHH....", "RRRHH..", "...RRHH", ".....RR"],
];

function brows(a: Art): void
{
	const {f, px} = a;
	const inks =
	{
		H: a.natural,
		R: rimTone(a, a.natural),
	};
	// Tall eyes and glasses push the eyebrows up, so neither a lash nor a frame ever sits on top of them.
	const bottom = a.eyeRow - Math.max(f.glasses ? 7 : 0, EYES[f.eyes]![1] + 2);
	const left = MID + a.eyeCol - 3;
	const over = (rows: readonly string[], lift = 0): number => bottom - rows.length + 1 - lift;
	switch (f.eyebrows)
	{
		case 4:
			// One brow across both eyes, its ends turned down.
			both(px, 0, bottom - 3, a.eyeCol + 2, 2, inks.H);
			both(px, 0, bottom - 1, a.eyeCol + 2, 1, inks.R);
			both(px, a.eyeCol + 2, bottom - 2, 2, 2, inks.H);
			both(px, a.eyeCol + 2, bottom, 2, 1, inks.R);
			break;
		case 5:
		{
			// Quizzical: one arch raised high, the other brow flat and low.
			const flat = ["HHHHHHH", "RRRRRRR"];
			stamp(px, 2 * MID - left - 7, over(BROWS[0]!, 2), BROWS[0]!, inks, true);
			stamp(px, left, over(flat), flat, inks);
			break;
		}
		default:
		{
			const rows = BROWS[f.eyebrows]!;
			twin(px, left, over(rows), rows, inks);
		}
	}
}

// Noses, centred on the middle of the face with the given row on the nose line. N is the line, F a fill.
const NOSES: readonly (readonly [number, readonly string[]])[] = [
	[2, ["N..N", "N..N", ".NN."]],
	[4, ["..N.", "..N.", ".N..", ".N..", "NNNN"]],
	[5, ["..N.", "..N.", "..N.", "..N.", "..NN", "N..N", ".NN."]],
	[2, ["..FF..", ".FHFF.", "NFFFFN", ".NFFN.", "..NN.."]],
	[4, [".N....", ".FN...", ".FFN..", ".FHFN.", "NFFFFN", ".NNNN."]],
	[1, [".N....N.", "N.N..N.N", "...NN..."]],
	[2, [".PPPP.", "PDPPDP", "PDPPDP", ".PPPP."]],
];

function nose(a: Art): void
{
	const {f, sk} = a;
	const [oy, rows] = NOSES[f.nose]!;
	// On the darkest skins a darker fill disappears, so the fills are lighter there.
	const fill = f.skin >= 3 ? mix(sk, a.line, 0.3) : SHADOW[f.skin]!;
	stamp(
		a.px,
		MID - rows[0]!.length / 2,
		a.noseRow - oy,
		rows,
		{
			N: a.line,
			F: fill,
			H: shade(fill, 0.25),
			P: "#f7a1b0",
			D: "#5a2a30",
		},
	);
}

// Mouths, centred on the middle of the face with the given row on the mouth line.
const MOUTHS: readonly (readonly [number, readonly string[]])[] = [
	[-1, ["M......M", ".MMMMMM."]],
	[0, ["MMMMMMMM", "MWGWWGWM", "MWGWWGWM", ".MWWWWM.", "..MMMM.."]],
	[0, [".MMMMMM.", "M......M"]],
	[0, [".MM.", "MDDM", "MDDM", "MDDM", ".MM."]],
	[-1, ["MMMMMM"]],
	[-1, ["M......M", ".MMMMMM.", "..MTTM..", "..MTSM..", "...MM..."]],
	[1, ["........M", "......MM.", "....MM...", "MMMM....."]],
	[-1, ["M......M", ".MWWWWM.", "..WWWW..", "..MMMM.."]],
	[0, ["..RR..RR..", "M.RRRRRR.M", "...DDDD...", "M..RRRR..M", "....RR...."]],
];

function mouth(a: Art): void
{
	const [oy, rows] = MOUTHS[a.f.mouth]!;
	const lip = LIP[a.f.skin]!;
	stamp(
		a.px,
		MID - Math.floor(rows[0]!.length / 2),
		a.mouthRow - oy,
		rows,
		{
			M: lip,
			W: "#fff",
			G: "#c9cbd6",
			D: "#7a2228",
			T: "#ff7a8a",
			S: "#e0546a",
			R: "#e0455a",
		},
	);
}

// Facial hair that lies under the mouth line; the mustaches are drawn over it.
function beard(a: Art): void
{
	const {f, g, px} = a;
	const {w, b, ey, ny, my} = g;
	const hc = a.natural;
	// Cells counted from the middle of the face and from the mouth line.
	const u = (X: number): number => off(X) / CELL;
	const v = (Y: number): number => (Y - Y0) / CELL - a.mouthRow;
	// Sideburns hug the edge of the face and stop short of the cheeks.
	const cheek = (Math.round((w * 0.52) / CELL) + 3) * CELL;
	const burns: Test = (X, Y) => Y > ey - 18 && a.head(X, Y) && off(X) > Math.max(headHalf(f, g, Y) - 13, cheek);
	switch (f.facialHair)
	{
		case 3:
			// A full beard starts below the cheeks and leaves an opening, so cheeks and mouth show on any hair color.
			mass(
				a,
				(X, Y) =>
					(a.head(X, Y) || a.head(X, Y - 8)) &&
					Y > (u(X) < 7 ? my - 16 : ny + 16) &&
					!(u(X) < 6 && v(Y) > -1 && v(Y) < 5 && u(X) + Math.abs(v(Y) - 2) < 8),
				hc,
			);
			break;
		case 4:
			mass(a, (X, Y) => v(Y) > 3 && v(Y) < 9 && a.head(X, Y) && u(X) < (v(Y) < 6 ? 3 : v(Y) < 8 ? 2 : 1), hc);
			break;
		case 5:
		{
			// Stubble: a scatter of dots over the jaw and upper lip, clear of the mouth.
			const speck = shade(hc, f.skin >= 3 ? 0.5 : -0.4);
			area(
				px,
				(X, Y) =>
				{
					const [i, j] = [cellCol(X), cellRow(Y)];
					return (
						j % 2 === 0 &&
						(i + j) % 4 === 0 &&
						Y > my - 12 &&
						a.head(X, Y, -5) &&
						!(u(X) < 6 && v(Y) > -2 && v(Y) < 4)
					);
				},
				speck,
			);
			break;
		}
		case 6:
			mass(a, (X, Y) => burns(X, Y) && Y < ny + 20 - Math.max(0, headHalf(f, g, Y) - off(X) - 5), hc);
			break;
		case 7:
			// A goatee circles the mouth: mustache, chin and the strips that join them.
			mass(
				a,
				(X, Y) =>
					v(Y) > -4 &&
					Y < Math.min(my + 34, b + 4) &&
					u(X) < (v(Y) < 5 ? 7 : 12 - v(Y)) &&
					!(u(X) < 5 && v(Y) > -1 && v(Y) < 4 && u(X) + Math.abs(v(Y) - 1.5) < 7),
				hc,
			);
			break;
		case 8:
			// Mutton chops: sideburns that run under the cheeks and meet in a mustache, with the chin bare.
			mass(
				a,
				(X, Y) =>
					a.head(X, Y) &&
					((burns(X, Y) && Y < my + 12) ||
						(v(Y) > -4 &&
							v(Y) < (u(X) < 3 ? -1 : u(X) < 6 ? 0 : u(X) < 9 ? 1 : 3) &&
							!(u(X) < 1 && v(Y) > -2))),
				hc,
			);
			break;
		case 9:
			// A chin strap: one thin line of beard along the jaw, ear to ear.
			mass(a, (X, Y) => Y > ny + 4 && a.head(X, Y) && !a.head(X, Y, -9), hc);
			break;
		case 10:
			// A long chin beard that hangs to a point below the chin.
			mass(
				a,
				(X, Y) =>
					v(Y) > 2 &&
					off(X) <
						along(Y, [
							[my + 12, 20],
							[b, 15],
							[b + 26, 0],
						]),
				hc,
			);
			break;
	}
}

function mustache(a: Art): void
{
	const hc = a.natural;
	const inks =
	{
		H: hc,
		R: rimTone(a, hc),
	};
	if (a.f.facialHair === 1)
		stamp(a.px, MID - 5, a.mouthRow - 4, [".HHH..HHH.", "HHHHHHHHHH", "RRRRRRRRRR", "R...RR...R"], inks);
	if (a.f.facialHair === 2)
	{
		// A handlebar: wide, with both ends curled up.
		stamp(
			a.px,
			MID - 9,
			a.mouthRow - 5,
			[
				"H................H",
				"R...HHHHHHHHHH...R",
				"RH.HHHHHHHHHHHH.HR",
				"RRHHHRRRRRRRRHHHRR",
				".RRRR........RRRR.",
			],
			inks,
		);
	}
}

function cheeks(a: Art): void
{
	const {f, g, sk, px} = a;
	const dx = Math.round((g.w * 0.52) / CELL),
		top = row(g.ny + 8) - 2;
	switch (f.cheeks)
	{
		case 1:
			twin(
				px,
				MID + dx - 3,
				top,
				[".BBBB.", "BBBBBB", "BBBBBB", ".BBBB."],
				{
					B: mix(sk, "#ff7a95", 0.55),
				},
			);
			break;
		case 2:
			twin(
				px,
				MID + dx - 4,
				top,
				["F..F..F", "..F..F.", "F..F..F", ".F..F.."],
				{
					F: mix(sk, a.line, 0.75),
				},
			);
			break;
		case 3:
			// Two stripes of face paint on each cheek.
			twin(
				px,
				MID + dx - 3,
				top,
				["BBBBBB", "......", "BBBBBB"],
				{
					B: "#3a78f2",
				},
			);
			break;
		case 4:
			stamp(
				px,
				MID - dx - 4,
				top,
				[".OOOOOO.", "OTTPPTTO", "OTTPPTTO", ".OOOOOO."],
				{
					O: "#9a6233",
					T: "#fff1d6",
					P: "#dba566",
				},
			);
			break;
		case 5:
			stamp(
				px,
				MID + dx - 4,
				top - 2,
				["...Y...", "...Y...", "YYYYYYY", ".YYYYY.", "..YYY..", ".YYDYY.", ".YD.DY."],
				{
					Y: "#ffd23f",
					D: "#d99a16",
				},
			);
			break;
	}
}

function body(a: Art): void
{
	const {f, g, px} = a;
	const cloth = CLOTH[f.shirt]!;
	const dark = shade(cloth, -0.45);
	box(px, MID - 4, row(g.b - 16), 8, row(236) - row(g.b - 16), shade(SHADOW[f.skin]!, -0.1));
	const pattern = (X: number, Y: number): string | undefined =>
	{
		const dx = off(X);
		switch (f.shirtStyle)
		{
			case 1:
				return Y > 244 ? (Y < 248 ? dark : undefined) : Y > 236 && Y < 240 ? dark : undefined;
			case 3:
				return dx > 40 + (Y - 219) * 0.4 ? shade(cloth, -0.35) : undefined;
			case 4:
				return Math.abs(dx - 30 - (Y - 224) * 0.15) < 6 ? "#3b3b45" : undefined;
			case 5:
				return Math.abs(Y - 247 + 10 * tri((X - 16) / 14)) < 3.6 ? "#fff" : undefined;
		}
		return undefined;
	};
	area(
		px,
		(X, Y) => Y > shirtTop(off(X)),
		(X, Y) =>
		{
			const dx = off(X);
			// Every pattern spreads across the whole shirt, so neckwear never covers all of it.
			const drawn = pattern(X, Y);
			if (drawn) return drawn;
			if (dx < 40 && Y - CELL <= shirtTop(dx)) return shade(cloth, 0.35);
			return X > 168 ? shade(cloth, -0.18) : cloth;
		},
	);
	if (f.shirtStyle === 2)
	{
		for (const [x, y] of [
			[30, 244],
			[50, 232],
			[68, 246],
			[84, 238],
		] as const)
			both(px, col(100 - x) - MID - 1, row(y) - 1, 2, 2, "#fff");
	}
}

function neckwear(a: Art): void
{
	const {px} = a;
	switch (a.f.neckwear)
	{
		case 1:
			// A bow tie: two outlined wings round a lighter knot, wide enough to read on any shirt.
			stamp(
				px,
				MID - 7,
				64,
				[
					"OOO........OOO",
					"OHHOO....OOKKO",
					"OHKKKOOOOKKKKO",
					"OKKKKOCCOKKKKO",
					"OKKKKOCCOKKKKO",
					"OKKKKOOOOKKKKO",
					"OKKOO....OOKKO",
					"OOO........OOO",
				],
				{
					O: OUTLINE,
					K: "#3a3f5c",
					H: "#646c94",
					C: "#8790b8",
				},
			);
			break;
		case 2:
		{
			// Pearls: a string of big beads on a dark thread, each with a shine, so they show on the palest skin.
			const beads = Array.from(
				{
					length: 6,
				},
				(_, i) =>
				{
					const turn = Math.PI * (0.06 + (0.88 * i) / 5);
					return [col(100 - Math.cos(turn) * 32) - 1, row(213 + Math.sin(turn) * 22) - 1] as const;
				},
			);
			for (const [x, y] of beads)
				stamp(
					px,
					x - 1,
					y - 1,
					[".OO.", "OOOO", "OOOO", "OOOO", ".OO."],
					{
						O: OUTLINE,
					},
				);
			for (const [x, y] of beads)
			{
				stamp(
					px,
					x,
					y,
					["HW", "WW", "WS"],
					{
						W: "#f4eedf",
						H: "#fff",
						S: "#bdb3a0",
					},
				);
			}
			break;
		}
		case 3:
			// A scarf: a striped band round the neck and a fringed tail.
			area(
				px,
				(X, Y) =>
				{
					const dx = off(X);
					return dx < 27 && Y > 206 + 6 * (1 - (dx / 26) ** 2) && Y < 224 + 8 * (1 - (dx / 26) ** 2);
				},
				(X) => ([-6, -3, 2, 5].includes(cellCol(X) - MID) ? "#c0392b" : "#f39c12"),
			);
			box(px, MID - 6, 68, 5, 5, "#f39c12");
			box(px, MID - 6, 70, 5, 1, "#c0392b");
			for (const x of [-6, -4, -2]) dot(px, MID + x, 73, "#f39c12");
			break;
		case 4:
			// A necktie: a white collar, a knot and a blade that widens to the hem.
			twin(
				px,
				MID,
				64,
				[".WWWW.", "WWWWWW", "WWWWWW", "..WWWW", "...WW."],
				{
					W: "#fff",
				},
			);
			both(px, 0, 66, 2, 2, "#6c2f87");
			for (const [i, half] of [1, 2, 2, 2, 3, 3, 3].entries()) both(px, 0, 68 + i, half, 1, "#8e44ad");
			box(px, MID - 1, 69, 1, 6, "#b06cd0");
			break;
		case 5:
		{
			// A chunky chain of alternating links, two cells thick so it shows on a small card, with a red pendant.
			for (let i = 0; i <= 8; i++)
			{
				const s = i / 8;
				const x = col(83 * (1 - s) ** 2 + 180 * s * (1 - s) + 100 * s * s),
					y = row(213 * (1 - s) ** 2 + 464 * s * (1 - s) + 236 * s * s);
				both(px, MID - x - 1, y, 2, 2, i % 2 ? GOLD_DARK : GOLD);
			}
			stamp(
				px,
				MID - 3,
				69,
				[".GGGG.", "GRHRRG", "GRRRRG", "GRRRDG", ".GRDG.", "..GG.."],
				{
					G: GOLD_DARK,
					R: "#e5484d",
					H: "#ffd0d2",
					D: "#a82a30",
				},
			);
			break;
		}
		case 6:
			// A bandana: a blue triangle with white dots.
			area(
				px,
				(X, Y) =>
				{
					const dx = off(X);
					return Y > 208 + 6 * (1 - (dx / 26) ** 2) && Y < 252 - dx * 1.6;
				},
				(_, Y) => (Y < 216 ? "#2458b8" : "#2f6fde"),
			);
			both(px, 2, 66, 1, 1, "#fff");
			both(px, 0, 68, 1, 1, "#fff");
			both(px, 0, 71, 1, 1, "#fff");
			break;
	}
}

// Frames as worn over the right eye, each eleven cells or more across so every lens clears the largest eye.
const FRAMES: readonly (readonly string[])[] = [
	[
		"...FFFFF...",
		"..F.....F..",
		".F.......F.",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		".F.......F.",
		"..F.....F..",
		"...FFFFF...",
	],
	[
		"FFFFFFFFFFF",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"FFFFFFFFFFF",
	],
	[
		"FFFFFFFFFFF",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........F",
		"F.........D",
		".F.......D.",
		".F.......D.",
		"..F.....D..",
		"...DDDDD...",
	],
	[
		"...FFFFF...",
		"..F.....F..",
		".F.......F.",
		"F.........F",
		"F.........F",
		"F.........D",
		"F.........D",
		"F.........D",
		".F.......D.",
		"..F.....D..",
		"...DDDDD...",
	],
	[
		"..........FF",
		".FFFFFFFFFF.",
		"F.........F.",
		"F.........F.",
		"F.........F.",
		"F.........F.",
		"F.........F.",
		"F.........F.",
		"F........F..",
		".F......F...",
		"..FFFFFF....",
	],
];

function glasses(a: Art): void
{
	const {f, px} = a;
	if (!f.glasses) return;
	const rows = FRAMES[f.glasses - 1]!;
	const dark = f.skin >= 3 ? a.line : FRAME;
	const inks = [
		{
			F: dark,
		},
		{
			F: dark,
		},
		{
			F: "#d49a00",
			D: "#8f6400",
		},
		{
			F: "#d49a00",
			D: "#8f6400",
		},
		{
			F: "#ff4fa0",
		},
	][f.glasses - 1]!;
	const left = MID + a.eyeCol - 5,
		top = a.eyeRow - (f.glasses === 5 ? 6 : 5);
	if (f.glasses === 4)
	{
		// A monocle sits on one eye, with a chain hanging down the cheek.
		stamp(px, left, top, rows, inks);
		for (const [i, dx] of [5, 5, 5, 4, 3, 2].entries()) dot(px, MID + a.eyeCol + dx, a.eyeRow + 5 + i * 2, GOLD);
		return;
	}
	twin(px, left, top, rows, inks);
	// The bridge joins the lenses, and an arm runs from each to the edge of the face.
	const level = a.eyeRow - (f.glasses === 3 ? 5 : 1);
	both(px, 0, level, a.eyeCol - 5, 1, inks.F);
	if (f.glasses === 5) return;
	for (let x = a.eyeCol + 6; a.head(cellX(MID + x), cellY(a.eyeRow - 1)); x++)
		both(px, x, a.eyeRow - 1, 1, 1, inks.F);
}

function hat(a: Art): void
{
	const {f, g, px} = a;
	if (!f.hat) return;
	const {w, t, ey} = g;
	const afro = f.hairStyle === 4;
	const lift = LIFT[f.hairStyle] ?? 0;
	const {hy, hw} = fit(f, g);
	const c = HATC[f.hatColor]!;
	const low = shade(c, -0.22);
	const dome =
		(h: number, half = hw): Test =>
		(X, Y) =>
			Y < hy && (off(X) / half) ** 2.5 + ((hy - Y) / (h + 2)) ** 2.5 <= 1;
	// A band over the top of the head, for the hats that are worn on one.
	const band = (tone: string): void =>
	{
		area(px, (X, Y) => Y < ey - 4 && a.head(X, Y, 5) && !a.head(X, Y, -3), tone);
	};
	const up = afro ? 20 : lift;
	switch (f.hat)
	{
		case 1:
		{
			// A baseball cap: a white front panel, a button on top and a long bill that sticks out to one side.
			// The crown hugs the head, so the bill stands well clear of it. On an afro it spans most of the ball of hair.
			const cw = afro ? hw - 6 : w + 3;
			area(px, dome(48, cw), (X) => (X > 100 + cw * 0.7 ? low : c));
			area(px, dome(46, cw * 0.52), "#fff");
			both(px, 0, row(hy - 52), 1, 1, low);
			// The bill is a long flat oval, outlined so it stands off the crown, reaching to the edge of the hat's region.
			const [rx, by] = [36, hy];
			const bx = 100 - cw - 25 + rx;
			area(px, (X, Y) => oval(X, Y, bx, by, rx + 4, 12), OUTLINE);
			area(
				px,
				(X, Y) => oval(X, Y, bx, by, rx, 8),
				(X, Y) => (Y > by + 3 ? shade(c, -0.5) : Y < by - 3 && X < bx ? shade(c, 0.25) : low),
			);
			break;
		}
		case 2:
			// A beanie: a ribbed band and a pompom.
			area(px, dome(52), (X) => (X > 100 + hw * 0.7 ? low : c));
			area(
				px,
				(X, Y) => off(X) < hw + 3 && Y > hy - 13 && Y < hy + 4,
				(X) => (cellCol(X) % 2 ? shade(c, -0.36) : shade(c, -0.12)),
			);
			area(
				px,
				(X, Y) => oval(X, Y, 100, hy - 59, 10.5, 10.5),
				(X, Y) => (X > 102 && Y > hy - 58 ? "#cfd2e0" : "#fff"),
			);
			break;
		case 3:
			// A top hat: a tall crown with a colored band over a flat brim.
			area(
				px,
				(X, Y) => off(X) < hw * 0.72 && Y > hy - 62 && Y < hy,
				(X, Y) =>
					Y > hy - 21 && Y < hy - 8
						? c
						: X < 100 - hw * 0.72 + 9 && X > 100 - hw * 0.72 + 4
							? "#55555f"
							: "#2d2d2d",
			);
			area(
				px,
				(X, Y) => oval(X, Y, 100, hy, hw + 15, 7.5),
				(_, Y) => (Y > hy ? "#2d2d2d" : "#44444e"),
			);
			break;
		case 4:
		{
			// A crown: three points over a band set with gems.
			const tips: Points = [
				[0, hy - 46],
				[hw * 0.4, hy - 16],
				[hw * 0.5, hy - 16],
				[hw * 0.84, hy - 38],
				[hw * 0.88, hy - 38],
			];
			area(
				px,
				(X, Y) => off(X) < hw * 0.88 && Y < hy + 3 && Y > along(off(X), tips),
				(X, Y) => (Y > hy - 2 ? "#c9952a" : Y < along(off(X), tips) + CELL ? "#ffe68a" : "#f5c542"),
			);
			both(px, 0, row(hy - 12), 1, 2, "#e74c3c");
			both(px, col(100 + hw * 0.5) - MID - 1, row(hy - 11), 2, 2, "#3498db");
			break;
		}
		case 5:
		{
			// A headband with a bow to one side.
			band(c);
			const [bx, by] = [col(100 - w * 0.5), row(t + 4 - up)];
			stamp(
				px,
				bx - 6,
				by - 4,
				[
					"BB........BB",
					"BBBB....BBBB",
					"BBBBBKKBBBBB",
					"BBBBBKKBBBBB",
					"DBBBBKKBBBBD",
					"DDBB....BBDD",
					"DD........DD",
				],
				{
					B: c,
					K: shade(c, -0.4),
					D: low,
				},
			);
			break;
		}
		case 6:
			// A party hat: a dotted cone with a pompom on the tip.
			area(
				px,
				(X, Y) => Y < hy + 2 && X > 72 + (hy - Y) * 0.5 && X < 132 - (hy - Y) * 0.4,
				(X, Y) => (X - (hy - Y) * 0.06 > 108 ? low : c),
			);
			for (const [x, y] of [
				[96, hy - 14],
				[111, hy - 30],
				[103, hy - 46],
				[118, hy - 9],
				[84, hy - 5],
			] as const)
				box(px, col(x) - 1, row(y) - 1, 2, 2, "#fff");
			area(
				px,
				(X, Y) => oval(X, Y, 106, hy - 70, 8.5, 8.5),
				(X, Y) => (X > 108 && Y > hy - 70 ? "#cfd2e0" : "#fff"),
			);
			break;
		case 7:
			// A propeller beanie: yellow panels and a propeller on a stalk.
			area(px, dome(50), (X) => (off(X) < 8 || (off(X) > hw * 0.45 && off(X) < hw * 0.72) ? "#f1c40f" : c));
			both(px, 0, row(hy - 62), 1, row(hy - 50) - row(hy - 62), "#3b3b45");
			both(px, 1, row(hy - 70), 6, 2, "#f1c40f");
			both(px, 1, row(hy - 70) + 1, 6, 1, "#c79a08");
			both(px, 0, row(hy - 70), 1, 2, c);
			break;
		case 8:
			// A fedora: a pinched tan crown, a colored band and a wide brim.
			area(
				px,
				(X, Y) =>
					Y < hy &&
					off(X) < hw * 0.8 &&
					Y >
						along(off(X), [
							[0, hy - 40],
							[hw * 0.3, hy - 49],
							[hw * 0.6, hy - 47],
							[hw * 0.8, hy - 34],
						]),
				(X, Y) =>
					Y > hy - 16 && Y < hy - 3
						? c
						: off(X) < 4 && Y < hy - 26
							? "#6f5335"
							: X > 100 + hw * 0.5
								? "#7e5f3e"
								: "#9a7650",
			);
			area(
				px,
				(X, Y) => oval(X, Y, 100, hy, hw + 20, 7.5),
				(_, Y) => (Y > hy ? "#7e5f3e" : "#b08a60"),
			);
			break;
		case 9:
			// A beret: a wide soft blob that slouches to one side, with a stalk on top.
			area(
				px,
				(X, Y) => oval(X, Y, 106, hy - 22, hw + 12, 24) && Y < hy + 2,
				(X, Y) => (Y < hy - 34 && X < 100 ? shade(c, 0.25) : c),
			);
			area(px, (X, Y) => off(X) < hw - 1 && Math.abs(Y - (hy + 6 - 9 * (off(X) / hw) ** 2)) < 5, low);
			box(px, col(106), row(hy - 46) - 3, 1, 3, low);
			break;
		case 10:
		case 11:
		{
			const cat = f.hat === 10;
			const tone = cat ? "#2b2b2b" : "#d92b2b";
			const by = t + 6 - up;
			const from = (X: number): number => off(X) - w * 0.55;
			if (cat)
			{
				// Cat ears: black triangles with pink insides.
				area(
					px,
					(X, Y) => Y < by + 6 && from(X) > -21 + (by + 6 - Y) * 0.54 && from(X) < 21 - (by + 6 - Y) * 0.3,
					tone,
				);
				area(
					px,
					(X, Y) => Y < by + 1 && from(X) > -10 + (by + 1 - Y) * 0.54 && from(X) < 11 - (by + 1 - Y) * 0.22,
					"#ffb3c7",
				);
			}
			else
			{
				// Devil horns: red, curving up and out to a point.
				const rise = (Y: number): number => Math.max(0, (by + 5 - Y) / 43);
				area(
					px,
					(X, Y) =>
						Y < by + 5 &&
						Y > by - 38 &&
						from(X) > -10 + 30 * rise(Y) ** 2.2 &&
						from(X) < 10 + 11 * rise(Y) ** 0.6,
					(X, Y) => (from(X) < -6 + 30 * rise(Y) ** 2.2 ? "#ff7a6a" : tone),
				);
			}
			band(tone);
			break;
		}
	}
}

// Outlines the silhouette, then merges the cells into as few rectangles as possible.
function emit(px: Tone[]): string
{
	const near = (i: number): number[] =>
	{
		const x = i % COLS;
		return [x > 0 ? i - 1 : -1, x < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS].filter(
			(n) => n >= 0 && n < px.length,
		);
	};
	// Every gap of empty cells gets the outline, except a tiny enclosed one such as the middle of a hoop earring.
	const seen = new Set<number>();
	const edge: number[] = [];
	for (const start of px.keys())
	{
		if (px[start] !== null || seen.has(start)) continue;
		const gap = [start];
		seen.add(start);
		for (let at = 0; at < gap.length; at++)
		{
			for (const n of near(gap[at]!))
			{
				if (px[n] !== null || seen.has(n)) continue;
				seen.add(n);
				gap.push(n);
			}
		}
		if (gap.length > 9) edge.push(...gap.filter((i) => near(i).some((n) => px[n] !== null)));
	}
	for (const i of edge) px[i] = OUTLINE;
	let out = "";
	let open = new Map<string, [number, number, number, number, string]>();
	const flush = (rects: Iterable<[number, number, number, number, string]>): void =>
	{
		for (const [x, y, w, h, tone] of rects)
			out += `<rect x="${X0 + x * CELL}" y="${Y0 + y * CELL}" width="${w * CELL}" height="${h * CELL}" fill="${tone}"/>`;
	};
	for (let y = 0; y < ROWS; y++)
	{
		const next = new Map<string, [number, number, number, number, string]>();
		for (let x = 0; x < COLS;)
		{
			const tone = px[y * COLS + x] ?? null;
			let n = 1;
			while (x + n < COLS && px[y * COLS + x + n] === tone) n++;
			if (tone !== null)
			{
				const key = `${x} ${n} ${tone}`;
				const above = open.get(key);
				if (above) above[3]++;
				next.set(key, above ?? [x, y, n, 1, tone]);
				open.delete(key);
			}
			x += n;
		}
		flush(open.values());
		open = next;
	}
	flush(open.values());
	return `<g shape-rendering="crispEdges">${out}</g>`;
}

function paint(f: Face): string
{
	const g = geo(f);
	const natural = HAIRC[f.hairColor]!;
	const sk = SKIN[f.skin]!;
	const a: Art =
	{
		f,
		g,
		px: Array.from<Tone>(
			{
				length: COLS * ROWS,
			},
		).fill(null),
		sk,
		line: LINE[f.skin]!,
		skins: new Set([sk]),
		natural,
		// Dye colors the hair on the head; eyebrows and facial hair keep the natural color.
		hair: f.hairDye ? DYEC[f.hairDye]! : natural,
		eyeCol: Math.floor(g.ex / CELL),
		eyeRow: Math.round((g.ey - Y0) / CELL - 0.5),
		noseRow: row(g.ny),
		mouthRow: row(g.my),
		head: (X, Y, grow = 0) =>
		{
			const half = headHalf(f, g, g.cy + ((Y - g.cy) * g.ry) / (g.ry + grow));
			return half >= 0 && off(X) <= (half * (g.w + grow)) / g.w;
		},
		room: () => true,
	};
	// Under a hat that covers the crown, hair above the hat's edge stays close to the head instead of poking out
	// beside it. The afro is the exception: its hat sits on top of it.
	if (CROWNED.has(f.hat) && f.hairStyle !== 4)
	{
		const {hy} = fit(f, g);
		a.room = (X, Y) => Y >= hy || a.head(X, Y, 4);
	}
	hairBack(a);
	body(a);
	neckwear(a);
	ears(a);
	head(a);
	cheeks(a);
	beard(a);
	hairFront(a);
	eyes(a);
	brows(a);
	nose(a);
	mouth(a);
	mustache(a);
	glasses(a);
	hat(a);
	return emit(a.px);
}

// Chunky pixel-art faces: flat colors on a grid of cells, a one-cell dark outline and a little edge shading.
export const pixel: ArtStyle =
{
	id: "pixel",
	name: "Pixel Arcade",
	blurb: "Chunky pixels from a late-night arcade.",
	defs: "",
	paint,
};
