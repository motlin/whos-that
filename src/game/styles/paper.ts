import {CLOTH, DYEC, EYEC, type Face, HAIRC, HATC, SKIN} from "../faces.ts";
import {geo, type Geo, shade, star} from "../geometry.ts";
import type {ArtStyle} from "./style.ts";

type Pt = [number, number];

// Nothing is outlined, so whatever is glued onto the skin is cut from paper that contrasts with it: a deeper skin tone
// on the three lighter skins and a lighter one on the two darkest.
const TONE = ["#c8946e", "#9f643a", "#5c3218", "#dba878", "#b07a4e"];
// The big noses are cut from paper part way between the skin and TONE, with a strip of TONE along their shadow side.
const LUMP = ["#e6c0a1", "#c88f60", "#915b31", "#a8754d", "#754d2f"];
const MOUTH = ["#9c2f3a", "#9c2f3a", "#5e1620", "#ffb3a3", "#ffb3a3"];
const LIPS = ["#e0455a", "#c2203c", "#7d0c20", "#ff5d73", "#ff5d73"];
const WHITE = "#fffdf5";
const DARK = "#1b1b1f";
const TIE = "#ff4d6d";
const GOLD = "#dba51c";
// How the outline bulges on each face shape: the exponents of x and y above the widest point, then below it. The heart
// narrows to a point below.
const BULGE = [
	[1, 1, 1, 1],
	[1, 1, 1, 1],
	[0.5, 0.5, 0.5, 0.5],
	[1, 1, 1, 1],
	[0.87, 0.87, 2, 1],
];
const STUBBLE = ((): Pt[] =>
{
	let s = 11;
	const r = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
	const a: Pt[] = [];
	while (a.length < 46)
	{
		const u = r() * 2 - 1,
			v = r();
		if (Math.abs(u) < 1 - v * 0.55 && !(Math.abs(u) < 0.34 && v < 0.32)) a.push([u, v]);
	}
	return a;
})();

interface Ctx
{
	f: Face;
	g: Geo;
	sk: string;
	// The natural hair color, for eyebrows and facial hair, and the color of the hair on the head.
	hc: string;
	dye: string;
	tone: string;
	dark: boolean;
}

// A run of corners written as "x,y x,y".
function pts(strings: TemplateStringsArray, ...values: number[]): Pt[]
{
	const flat = String.raw(
		{
			raw: strings,
		},
		...values,
	)
		.split(/[\s,]+/)
		.map(Number);
	const p: Pt[] = [];
	for (let i = 0; i + 1 < flat.length; i += 2) p.push([flat[i]!, flat[i + 1]!]);
	return p;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;
const d = (p: Pt[]): string => "M" + p.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L") + "Z";
const cut = (fill: string, path: string): string => `<path fill="${fill}" d="${path}"/>`;
const holed = (fill: string, path: string): string => `<path fill="${fill}" fill-rule="evenodd" d="${path}"/>`;
// One sheet of paper: everything in it lies flat together and casts one shadow.
const layer = (s: string): string => (s ? `<g filter="url(#paper-cut)">${s}</g>` : "");
const mirror = (p: Pt[]): Pt[] => p.map(([x, y]) => [200 - x, y]);
const both = (p: Pt[]): string => d(p) + d(mirror(p));
// A shape given as its left half, from the top of the centre line to the bottom of it.
const sym = (half: Pt[]): Pt[] => [...half, ...mirror(half).toReversed()];

function ngon(cx: number, cy: number, rx: number, ry: number, n: number, rot = 0): Pt[]
{
	return Array.from(
		{
			length: n,
		},
		(_, i) =>
		{
			const a = rot + (i / n) * 2 * Math.PI;
			return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
		},
	);
}

function turn(p: Pt[], deg: number, cx: number, cy: number): Pt[]
{
	const a = (deg * Math.PI) / 180,
		co = Math.cos(a),
		si = Math.sin(a);
	return p.map(([x, y]) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]);
}

// Moves every corner of a line sideways by k, keeping the snips between them parallel.
function offset(p: Pt[], k: number, closed: boolean): Pt[]
{
	const n = p.length;
	const normal = (a: Pt, b: Pt): Pt =>
	{
		const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		return [(b[1] - a[1]) / l, (a[0] - b[0]) / l];
	};
	return p.map((q, i) =>
	{
		const first = !closed && i === 0,
			last = !closed && i === n - 1;
		const before = normal(first ? q : p[(i + n - 1) % n]!, first ? p[1]! : q);
		const after = last ? before : normal(q, p[(i + 1) % n]!);
		const l = Math.hypot(before[0] + after[0], before[1] + after[1]) || 1,
			mx = (before[0] + after[0]) / l,
			my = (before[1] + after[1]) / l;
		const reach = k / Math.max(0.5, mx * before[0] + my * before[1]);
		return [q[0] + mx * reach, q[1] + my * reach];
	});
}

// A strip of paper of one width cut along a line.
const strip = (line: Pt[], width: number): Pt[] => [
	...offset(line, width / 2, false),
	...offset(line, -width / 2, false).toReversed(),
];

// The same shape cut smaller by k all round: with the shape itself it makes a frame.
function inset(p: Pt[], k: number): Pt[]
{
	let area = 0;
	for (const [i, [x, y]] of p.entries())
	{
		const [nx, ny] = p[(i + 1) % p.length]!;
		area += x * ny - nx * y;
	}
	return offset(p, area > 0 ? -k : k, true);
}

const frame = (outer: Pt[], width: number): string => d(outer) + d(inset(outer, width));
const pair = (lens: Pt[], width: number): string => frame(lens, width) + frame(mirror(lens), width);

// A point on the head's outline: the angle runs from the right side (0) down round the chin (π/2) and over the top
// (3π/2).
function hp(c: Ctx, a: number, grow = 0): Pt
{
	const {w, cy, ry} = c.g;
	const co = Math.cos(a),
		si = Math.sin(a);
	const [xu, yu, xl, yl] = BULGE[c.f.faceShape] as [number, number, number, number];
	return [
		100 + (w + grow) * Math.sign(co) * Math.abs(co) ** (si > 0 ? xl : xu),
		cy + (ry + grow) * Math.sign(si) * Math.abs(si) ** (si > 0 ? yl : yu),
	];
}

// The angle at which the right side of the outline passes the height y.
function lat(c: Ctx, y: number): number
{
	const {cy, ry} = c.g;
	const s = Math.max(-1, Math.min(1, (y - cy) / ry));
	const [, yu, , yl] = BULGE[c.f.faceShape] as [number, number, number, number];
	return Math.asin(Math.sign(s) * Math.abs(s) ** (1 / (s > 0 ? yl : yu)));
}

const sweep = (c: Ctx, a0: number, a1: number, n: number, grow = 0): Pt[] =>
	Array.from(
		{
			length: n + 1,
		},
		(_, i) => hp(c, a0 + ((a1 - a0) * i) / n, grow),
	);
// The outline from the left side at height y, over the top of the head, to the right side.
const over = (c: Ctx, y: number, n: number, grow = 0): Pt[] =>
	sweep(c, Math.PI - lat(c, y), 2 * Math.PI + lat(c, y), n, grow);
// The outline from the right side at height y, round the chin, to the left side.
const under = (c: Ctx, y: number, n: number, grow = 0): Pt[] => sweep(c, lat(c, y), Math.PI - lat(c, y), n, grow);
// Half the width of the head at height y.
const edge = (c: Ctx, y: number): number => hp(c, lat(c, y))[0] - 100;

function hairBack(c: Ctx): string
{
	const {w, t, ey, L, R} = c.g;
	switch (c.f.hairStyle)
	{
		case 2:
		{
			const x = L - 12,
				y0 = t - 8,
				y1 = ey + 48;
			return layer(
				cut(
					c.dye,
					d(
						sym(
							pts`100,${y0} ${x + 26},${y0 + 1} ${x + 7},${y0 + 15} ${x},${y0 + 40} ${x - 2},${y1 - 12} ${x + 9},${y1} 100,${y1 - 1}`,
						),
					),
				),
			);
		}
		case 3:
			return layer(
				cut(
					c.dye,
					d(
						sym(
							pts`100,${t - 12} ${100 - w * 0.5},${t - 10} ${L - 8},${t + 6} ${L - 14},${t + 34} ${L - 22},236 ${L - 4},244 100,244`,
						),
					),
				),
			);
		case 4:
		{
			const cy = t + 34,
				r = w + 20;
			let p = d(ngon(100, cy, r, r, 14, 0.2));
			for (let i = 0; i < 14; i++)
			{
				const a = Math.PI * (0.8 + (i * 1.4) / 13);
				p += d(ngon(100 + Math.cos(a) * r, cy + Math.sin(a) * r, 15, 15, 7, i));
			}
			return layer(cut(c.dye, p));
		}
		case 5:
			return (
				layer(cut(c.dye, d(turn(ngon(R + 17, t + 64, 16, 40, 8, 0.4), 22, R + 17, t + 64)))) +
				layer(cut(TIE, d(ngon(R + 4, t + 32, 7, 7, 5, 0.3))))
			);
		case 7:
			return layer(cut(c.dye, both(ngon(L + 4, t + 2, 23, 23, 8, 0.2))));
		case 11:
		{
			// Two braids hang beside the neck, each a chain of knots with a tie at the end.
			let knots = "";
			for (let i = 0; i < 5; i++)
				knots += both(ngon(L - 9 + (i % 2 ? 2 : -2), ey + 28 + i * 15, 10.5, 11, 6, i % 2 ? 0.5 : 0));
			return layer(cut(c.dye, knots)) + layer(cut(TIE, both(ngon(L - 9, ey + 102, 6, 6, 5, 0.3))));
		}
	}
	return "";
}

function hairFront(c: Ctx): string
{
	const {w, t, ey, L, R} = c.g;
	const fb = ey - 28;
	const shine = (x: number, y: number): string =>
		layer(
			cut(
				shade(c.sk, 0.45),
				d(
					pts`${x},${y + 8} ${x + 9},${y + 1} ${x + 25},${y} ${x + 23},${y + 5} ${x + 11},${y + 6} ${x + 4},${y + 10}`,
				),
			),
		);
	switch (c.f.hairStyle)
	{
		case 0:
			return shine(100 - w * 0.45, t + 9);
		case 1:
		{
			const p: Pt[] = [];
			for (let i = 0; i <= 12; i++) p.push(hp(c, Math.PI * (1.08 + (0.84 * i) / 12), i % 2 ? 23 : 3));
			for (let i = 0; i <= 7; i++) p.push([R - 4 - ((2 * w - 8) * i) / 7, i % 2 ? fb - 9 : fb]);
			return layer(cut(c.dye, d(p)));
		}
		case 2:
		{
			const x = edge(c, ey - 4);
			return layer(
				cut(
					c.dye,
					d([
						...over(c, ey - 4, 10, 4),
						...pts`${100 + x - 9},${ey - 5} ${100 + x - 11},${fb} ${100 - x + 11},${fb + 1} ${100 - x + 9},${ey - 5}`,
					]),
				),
			);
		}
		case 3:
			return layer(
				cut(
					c.dye,
					d([
						...over(c, ey + 6, 10, 4),
						...pts`${R - 5},${ey - 8} ${R - 20},${fb - 2} 100,${fb - 5} 84,${t + 10} ${L + 16},${fb - 3} ${L + 6},${ey - 6}`,
					]),
				),
			);
		case 4:
			return layer(
				cut(
					c.dye,
					d([...over(c, ey - 10, 10, 2), ...pts`${R - 9},${fb + 2} 100,${fb - 8} ${L + 9},${fb + 2}`]),
				),
			);
		case 5:
			return layer(
				cut(
					c.dye,
					d([
						...over(c, ey - 8, 10, 3),
						...pts`${R - 13},${fb + 1} ${100 + w * 0.3},${fb - 8} ${100 - w * 0.3},${fb - 9} ${L + 13},${fb + 1}`,
					]),
				),
			);
		case 6:
			return layer(
				cut(
					c.dye,
					d(
						pts`88,${t + 26} 85,${t - 6} 92,${t - 22} 96,${t - 13} 100,${t - 38} 104,${t - 13} 108,${t - 22} 115,${t - 6} 112,${t + 26}`,
					),
				),
			);
		case 7:
		case 11:
			// A centre parting: the hairline drops to each side of a notch.
			return layer(
				cut(
					c.dye,
					d([
						...over(c, ey - 8, 10, 3),
						...pts`${R - 9},${fb - 1} 107,${fb - 7} 100,${t + 7} 93,${fb - 7} ${L + 9},${fb - 1}`,
					]),
				),
			);
		case 8:
		{
			let p = d([...over(c, ey - 10, 10, 2), ...pts`${R - 9},${fb + 1} 100,${fb - 6} ${L + 9},${fb + 1}`]);
			// The curls stop above the ears, so ears and earrings stay in sight.
			for (let i = 0; i < 11; i++)
			{
				const [x, y] = hp(c, Math.PI * (1.15 + (i * 0.7) / 10), 5);
				p += d(ngon(x, y, 11, 11, 6, i));
			}
			return layer(cut(c.dye, p));
		}
		case 9:
		{
			// Balding: a tuft over each ear and a bare, shiny top.
			const a = Math.PI - lat(c, ey + 2);
			const tuft: Pt[] = [
				hp(c, a, 5),
				hp(c, a + 0.3, 10),
				hp(c, a + 0.6, 9),
				hp(c, a + 0.95, 2),
				hp(c, a + 0.62, -9),
				hp(c, a + 0.3, -11),
				hp(c, a, -9),
			];
			return layer(cut(c.dye, both(tuft))) + shine(100 - w * 0.3, t + 8);
		}
		case 10:
			// A side part: the hair piles high on one side and sweeps down across the forehead.
			return layer(
				cut(
					c.dye,
					d(
						pts`${L - 3},${ey - 8} ${L - 5},${t + 12} ${L + 5},${t - 8} ${L + 17},${t - 14} ${L + 24},${t - 7} ${L + 38},${t - 28} ${100 + w * 0.2},${t - 34} ${R - 8},${t - 27} ${R + 6},${t - 4} ${R + 3},${ey - 8} ${R - 12},${fb + 6} 100,${fb + 1} ${L + 24},${t + 8} ${L + 10},${fb - 4}`,
					),
				),
			);
		case 12:
			// A flat-top: straight sides and a level top.
			return layer(
				cut(
					c.dye,
					d(
						pts`${L - 3},${ey - 8} ${L - 6},${t - 23} ${R + 6},${t - 25} ${R + 3},${ey - 8} ${R - 9},${fb + 2} 100,${fb - 4} ${L + 9},${fb + 2}`,
					),
				),
			);
		case 13:
		{
			// A bowl cut: a round cap with a straight fringe just above the eyebrows.
			const x = edge(c, ey - 2);
			return layer(
				cut(
					c.dye,
					d([
						...over(c, ey - 2, 10, 8),
						...pts`${100 + x - 7},${ey - 3} ${100 + x - 8},${fb + 5} ${100 - x + 8},${fb + 6} ${100 - x + 7},${ey - 3}`,
					]),
				) + cut(shade(c.dye, 0.3), d(strip(sweep(c, Math.PI * 1.3, Math.PI * 1.7, 4, -6), 4.5))),
			);
		}
	}
	return "";
}

function ears(c: Ctx): string
{
	const {w, ey} = c.g;
	const y = ey + 10,
		x = 100 - (w - 3);
	const skin = shade(c.sk, -0.08);
	const fold = (dx: number, h: number): string =>
		cut(c.tone, both(pts`${x - dx - 2},${y - h} ${x - dx + 2.5},${y} ${x - dx - 2},${y + h} ${x - dx - 0.5},${y}`));
	switch (c.f.ears)
	{
		case 0:
			return cut(skin, both(ngon(x - 5, y, 10, 14, 7, 0.2))) + fold(7, 7);
		case 1:
			return cut(skin, both(ngon(x - 9, y, 15, 21, 7, 0.2))) + fold(12, 11);
		case 2:
			return cut(
				skin,
				both(
					pts`${x},${y - 10} ${x - 13},${y - 17} ${x - 24},${y - 30} ${x - 19},${y - 6} ${x - 9},${y + 13} ${x - 2},${y + 15} ${x},${y + 10}`,
				),
			);
	}
	return cut(skin, both(turn(ngon(x - 14, y, 16, 11, 7, 0.3), 25, x - 14, y)));
}

function earrings(c: Ctx): string
{
	const [dx, dy] = (
		[
			[5, 14],
			[9, 21],
			[8, 14],
			[14, 9],
		] as const
	)[c.f.ears]!;
	const x = 100 - (c.g.w - 3) - dx,
		y = c.g.ey + 10 + dy;
	switch (c.f.earrings)
	{
		case 1:
		{
			const hoop = ngon(x, y + 7, 9.4, 9.4, 8, 0.4);
			return holed(GOLD, frame(hoop, 3.6) + frame(mirror(hoop), 3.6));
		}
		case 2:
			return (
				cut(c.tone, both(pts`${x - 1},${y - 2} ${x + 1},${y - 2} ${x + 1},${y + 3} ${x - 1},${y + 3}`)) +
				cut(
					"#35c4f0",
					both(
						pts`${x},${y + 1} ${x + 6},${y + 12} ${x + 3.5},${y + 19} ${x - 3.5},${y + 19} ${x - 6},${y + 12}`,
					),
				)
			);
		case 3:
			return cut("#e5484d", both(ngon(x, y + 6, 8, 8, 8, 0.4)));
		case 4:
			return cut("#3fbf6f", both(pts`${x},${y - 1} ${x + 9.5},${y + 18} ${x - 9.5},${y + 18.5}`));
	}
	return "";
}

function eyes(c: Ctx): string
{
	const {ey: y, ex} = c.g;
	const ic = EYEC[c.f.eyeColor]!;
	const round = (x: number, r: number, ir: number, pr: number, dx = 0): string =>
		cut("#fff", d(ngon(x, y, r, r, 8, Math.PI / 8))) + iris(x + dx, y + 1, ir, pr);
	const iris = (x: number, iy: number, ir: number, pr: number): string =>
		cut(ic, d(ngon(x, iy, ir, ir, 8))) +
		`<circle cx="${r1(x)}" cy="${r1(iy)}" r="${pr}" fill="${DARK}"/>` +
		cut("#fff", d(ngon(x - ir * 0.4, iy - ir * 0.34, Math.max(1.6, ir * 0.3), Math.max(1.6, ir * 0.3), 4)));
	let o = "";
	for (const s of [-1, 1])
	{
		const x = 100 + s * ex;
		switch (c.f.eyes)
		{
			case 0:
				o += round(x, 10, 6.8, 3);
				break;
			case 1:
				o += round(x, 14, 9.5, 4.2);
				break;
			case 2:
				// Sleepy: a heavy lid of skin-tone paper covers the top half.
				o +=
					round(x, 11, 7, 3) +
					cut(
						c.tone,
						d(
							pts`${x - 12},${y - 1.5} ${x - 11.5},${y - 5.5} ${x - 5},${y - 12} ${x + 5},${y - 12} ${x + 11.5},${y - 5.5} ${x + 12},${y - 1.5}`,
						),
					);
				break;
			case 3:
				o +=
					cut(
						"#fff",
						d(
							pts`${x - 15},${y} ${x - 7},${y - 7.5} ${x + 7},${y - 7.5} ${x + 15},${y} ${x + 7},${y + 7.5} ${x - 7},${y + 7.5}`,
						),
					) + iris(x, y, 6.3, 2.8);
				break;
			case 4:
			{
				// A heavy lid line with four long lashes fanning outwards.
				const lash = (ax: number, ay: number, bx: number, by: number): string =>
					d(pts`${x + s * (ax - 1.6)},${y + ay} ${x + s * (ax + 1.6)},${y + ay} ${x + s * bx},${y + by}`);
				o +=
					round(x, 10, 6.8, 3) +
					cut(
						DARK,
						d(
							strip(
								pts`${x - 11},${y - 3} ${x - 7},${y - 9} ${x},${y - 11.5} ${x + 7},${y - 9} ${x + 11},${y - 3}`,
								3.6,
							),
						),
					) +
					cut(
						c.dark ? c.tone : DARK,
						lash(-2, -11, -2, -18) +
							lash(4.5, -10, 8.5, -17) +
							lash(8.5, -7, 16.5, -12) +
							lash(10.5, -3, 19.5, -3),
					);
				break;
			}
			case 5:
				o += round(x, 11, 7, 3, 4);
				break;
		}
	}
	return o;
}

// A piece of hair: its outline, then any holes cut in it.
type Piece = Pt[][];
const twin = (p: Pt[]): Piece[] => [[p], [mirror(p)]];
// The same shape cut by hand about k larger all round (smaller for a negative k), the margin wider at some corners than
// at others.
function ragged(p: Pt[], k: number): Pt[]
{
	const out = inset(p, -1);
	return p.map(([x, y], i) =>
	{
		const reach = k * (0.75 + ((i * 7) % 5) * 0.14);
		return [x + (out[i]![0] - x) * reach, y + (out[i]![1] - y) * reach];
	});
}
// Hair glued onto the two darkest skins would vanish there, so it is first glued onto a hand-cut piece of lighter paper,
// a little larger and set up and to the left: it shows on the lit side, and the hair's shadow falls on it below.
function fur(c: Ctx, pieces: Piece[]): string
{
	const backing = pieces.map(([outline, ...holes]) =>
		holed(c.tone, [ragged(outline!, 1.6), ...holes.map((h) => ragged(h, -1.6))].map(d).join("")),
	);
	const hair = pieces.map((piece) => holed(c.hc, piece.map(d).join("")));
	return (c.dark ? layer(`<g transform="translate(-1.5 -1.8)">${backing.join("")}</g>`) : "") + layer(hair.join(""));
}

function brows(c: Ctx): string
{
	const {ey, ex} = c.g;
	// Glasses push the eyebrows up, so no frame ever sits on top of them.
	const y = ey - (c.f.eyes === 1 ? 22 : 18) - (c.f.glasses ? 7 : 0);
	const one = (s: number): Pt[] =>
	{
		const x = 100 + s * ex,
			xo = x + s * 12,
			xi = x - s * 11;
		switch (c.f.eyebrows)
		{
			case 0:
				return strip(pts`${xi},${y + 1.5} ${x - s * 2},${y - 4} ${xo},${y + 2.5}`, 5.4);
			case 1:
				return pts`${xi - s},${y - 6} ${xo + s},${y - 5.5} ${xo},${y + 4} ${xi},${y + 4.5}`;
			case 2:
				return strip(pts`${xo},${y - 5} ${xi},${y + 4.5}`, 5.6);
			case 3:
				return strip(pts`${xo},${y + 4} ${xi},${y - 5.5}`, 5.6);
			case 5:
				return s < 0
					? strip(pts`${xi},${y - 5} ${x},${y - 14} ${xo},${y - 4}`, 5.4)
					: strip(pts`${xi},${y + 3.5} ${xo},${y + 1.5}`, 5.6);
		}
		return [];
	};
	if (c.f.eyebrows === 4)
		return fur(c, [
			[
				strip(
					pts`${100 - ex - 13},${y + 2} ${100 - ex},${y - 4.5} 100,${y + 0.5} ${100 + ex},${y - 4.5} ${100 + ex + 13},${y + 2}`,
					6.6,
				),
			],
		]);
	return fur(c, [[one(-1)], [one(1)]]);
}

function nose(c: Ctx): string
{
	const y = c.g.ny;
	switch (c.f.nose)
	{
		case 0:
			return cut(c.tone, d(strip(pts`93.5,${y - 2} 96.5,${y + 5} 103.5,${y + 5} 106.5,${y - 2}`, 3.6)));
		case 1:
			return cut(c.tone, d(strip(pts`101.5,${y - 16} 94,${y + 4.5} 105.5,${y + 4.5}`, 3.6)));
		case 2:
			return cut(
				c.tone,
				d(strip(pts`99.5,${y - 21} 102.5,${y - 4} 96.5,${y + 5} 101,${y + 9.5} 106.5,${y + 4}`, 3.6)),
			);
		case 3:
			return (
				cut(LUMP[c.f.skin]!, d(ngon(100, y, 10, 10, 7, 0.2))) +
				cut(c.tone, d(strip(ngon(100, y, 8.1, 8.1, 7, -1.6).slice(0, 5), 3.8)))
			);
		case 4:
		{
			const bulb = pts`95.5,${y - 19} 101,${y - 19.5} 112.5,${y - 4} 113.5,${y + 4} 107,${y + 9} 96,${y + 8} 92,${y + 2}`;
			return cut(LUMP[c.f.skin]!, d(bulb)) + cut(c.tone, d(strip(inset(bulb, 1.8).slice(1, 6), 3.6)));
		}
		case 5:
			return cut(
				c.tone,
				d(
					strip(
						pts`86.5,${y + 2.5} 91,${y - 4.5} 95.5,${y + 2} 100,${y + 5.5} 104.5,${y + 2} 109,${y - 4.5} 113.5,${y + 2.5}`,
						3.4,
					),
				),
			);
	}
	const nostril: Pt[] = pts`93.6,${y - 3.4} 98.2,${y - 3} 98,${y + 3.6} 94,${y + 3.2}`;
	return cut("#f7a1b0", d(ngon(100, y, 12, 9, 8, Math.PI / 8))) + cut("#5a2a30", both(nostril));
}

function mouth(c: Ctx): string
{
	const y = c.g.my;
	const mc = MOUTH[c.f.skin]!;
	const smile: Pt[] = pts`85,${y - 1.5} 93,${y + 3} 100,${y + 4.2} 107,${y + 3} 115,${y - 1.5} 110,${y + 7.5} 100,${y + 11.5} 90,${y + 7.5}`;
	switch (c.f.mouth)
	{
		case 0:
			return cut(mc, d(smile));
		case 1:
			return (
				cut(mc, d(pts`83,${y - 3} 117,${y - 3} 113,${y + 11} 100,${y + 17} 87,${y + 11}`)) +
				cut(
					WHITE,
					d(pts`86,${y - 3} 92.4,${y - 3} 92.4,${y + 4.4} 87.6,${y + 4.2}`) +
						d(pts`93.6,${y - 3} 99.4,${y - 3} 99.4,${y + 4.6} 93.6,${y + 4.4}`) +
						d(pts`100.6,${y - 3} 106.4,${y - 3} 106.4,${y + 4.4} 100.6,${y + 4.6}`) +
						d(pts`107.6,${y - 3} 114,${y - 3} 112.4,${y + 4.2} 107.6,${y + 4.4}`),
				)
			);
		case 2:
			return cut(
				mc,
				d(
					pts`85,${y + 11} 90,${y + 2} 100,${y - 2} 110,${y + 2} 115,${y + 11} 107,${y + 6.5} 100,${y + 5.3} 93,${y + 6.5}`,
				),
			);
		case 3:
			return cut(mc, d(ngon(100, y + 5, 8, 10, 7, 0.25)));
		case 4:
			return cut(mc, d(pts`88,${y + 2} 112,${y + 1.6} 112.5,${y + 6} 87.5,${y + 5.6}`));
		case 5:
			return (
				cut(
					"#ff7a8a",
					d(pts`94.5,${y + 5} 107.5,${y + 5} 107.5,${y + 15} 104,${y + 20.5} 98,${y + 20.5} 94.5,${y + 15}`),
				) +
				cut("#d9475c", d(pts`100.2,${y + 9} 101.8,${y + 9} 101.6,${y + 17} 100.4,${y + 17}`)) +
				// The mouth is open, so its top edge is straight where the smile's dips.
				cut(mc, d(pts`84,${y - 2} 116,${y - 2} 110,${y + 7.5} 100,${y + 11} 90,${y + 7.5}`))
			);
		case 6:
			return cut(
				mc,
				d(pts`87,${y + 3.4} 103,${y + 4.4} 113.5,${y - 5.5} 116,${y - 2} 104.5,${y + 8.6} 87,${y + 7.6}`),
			);
		case 7:
			// Buck teeth: two white teeth on a backing of mouth paper, hanging from a shallow smile.
			return (
				cut(
					mc,
					d(
						pts`86,${y - 1.5} 100,${y + 3.4} 114,${y - 1.5} 111.5,${y + 3.6} 100,${y + 7.6} 88.5,${y + 3.6}`,
					) + d(pts`93.4,${y + 3} 106.6,${y + 3} 106.6,${y + 15} 93.4,${y + 15}`),
				) +
				cut(
					WHITE,
					d(pts`94.8,${y + 4.4} 99.4,${y + 4.4} 99.4,${y + 13.6} 94.8,${y + 13.4}`) +
						d(pts`100.6,${y + 4.4} 105.2,${y + 4.4} 105.2,${y + 13.4} 100.6,${y + 13.6}`),
				)
			);
	}
	// Puckered lips, with a crease at each side.
	const lips = LIPS[c.f.skin]!;
	const crease = (dy: number, by: number): string => both(strip(pts`85.5,${y + dy} 80,${y + by}`, 2.2));
	return (
		cut(
			lips,
			d(
				pts`89.5,${y + 4} 95,${y - 4} 100,${y + 0.5} 105,${y - 4} 110.5,${y + 4} 106,${y + 12.5} 100,${y + 16.5} 94,${y + 12.5}`,
			),
		) +
		cut(shade(lips, c.dark ? -0.45 : -0.4), d(pts`90.5,${y + 4} 100,${y + 6} 109.5,${y + 4} 100,${y + 8.6}`)) +
		cut(c.tone, crease(1, -2.5) + crease(8, 11.5))
	);
}

function beard(c: Ctx): string
{
	const {b, ey, ny, my: y, w} = c.g;
	// A cheek's worth of sideburn: down the side of the head from under the hair, with its inner edge given as
	// distances in from the outline.
	const burn = (rows: [number, number][]): Pt[] => [
		...rows.map(([h]): Pt => [100 - edge(c, h) - 1, h]),
		...rows.map(([h, i]): Pt => [100 - edge(c, h) + i, h]).toReversed(),
	];
	switch (c.f.facialHair)
	{
		case 3:
		{
			// The full beard starts below the cheeks and leaves an opening, so cheeks and mouth show on any hair color.
			const a = lat(c, ny + 18);
			const jaw = Array.from(
				{
					length: 9,
				},
				(_, i): Pt =>
				{
					const th = a + ((Math.PI - 2 * a) * i) / 8;
					return hp(c, th, 3 + 7 * Math.sin(th) ** 3);
				},
			);
			const x = edge(c, ny + 18);
			return fur(c, [
				[
					[
						...jaw,
						...pts`${100 - x + 10},${ny + 21} 78,${y - 6} 90,${y - 11.5} 100,${y - 13} 110,${y - 11.5} 122,${y - 6} ${100 + x - 10},${ny + 21}`,
					],
					ngon(100, y + 8, 21, 14, 8, Math.PI / 8),
				],
			]);
		}
		case 4:
			return fur(c, [
				[pts`90.5,${y + 11.5} 100,${y + 9} 109.5,${y + 11.5} 105,${y + 27} 100,${y + 31.5} 95,${y + 27}`],
			]);
		case 5:
		{
			let dots = "";
			for (const [u, v] of STUBBLE) dots += d(ngon(100 + u * w * 0.75, y - 6 + v * (b - y + 2), 1.8, 1.8, 4));
			return cut(shade(c.hc, c.dark ? 0.5 : -0.4), dots);
		}
		case 6:
			// Sideburns start under the hair, so they join it, and run to the jaw short of the cheeks.
			return fur(
				c,
				twin([
					...burn(pts`${ey - 18},15 ${ey + 6},16 ${ny + 10},17`),
					...pts`${100 - edge(c, ny + 22) + 8},${ny + 23} ${100 - edge(c, ny + 20) - 1},${ny + 20}`,
				]),
			);
		case 7:
		{
			// A goatee circles the mouth: mustache, chin and the strips that join them.
			const low = Math.min(y + 34, b + 5);
			return fur(c, [
				[
					pts`78.5,${y - 7} 89,${y - 12.5} 100,${y - 14} 111,${y - 12.5} 121.5,${y - 7} 122.5,${y + 17} 112,${low} 100,${low + 3} 88,${low} 77.5,${y + 17}`,
					ngon(100, y + 6, 15.5, 10.5, 8, Math.PI / 8),
				],
			]);
		}
		case 8:
		{
			// Mutton chops: sideburns that run under the cheeks and meet in a mustache, with the chin bare.
			const side = burn(pts`${ey - 18},13 ${ey + 6},13 ${ny + 8},13`);
			const outer = side.slice(0, 3),
				inner = side.slice(3);
			return fur(
				c,
				twin([
					...outer,
					...pts`${100 - edge(c, ny + 20) - 1},${ny + 20} ${100 - edge(c, y + 6) + 2},${y + 7} ${100 - Math.max(w - 30, 17)},${y + 11} 86,${y + 0.5} 100,${y - 2.5} 100,${y - 9} 93.5,${y - 12.5} ${100 - Math.max(w - 32, 15)},${ny + 25} ${100 - edge(c, ny + 18) + 14},${ny + 18}`,
					...inner,
				]),
			);
		}
		case 9:
			// A chin strap: one thin band of beard along the jaw, ear to ear.
			return fur(c, [[[...under(c, ny + 4, 8, 1), ...under(c, ny + 4, 8, -7).toReversed()]]]);
		case 10:
			// A long chin beard that hangs to a point below the chin.
			return fur(c, [
				[pts`81,${y + 9.5} 100,${y + 13} 119,${y + 9.5} 113.5,${b + 2} 100,${b + 26} 86.5,${b + 2}`],
			]);
	}
	return "";
}

function mustache(c: Ctx): string
{
	const y = c.g.my;
	if (c.f.facialHair === 1)
		return fur(c, [[sym(pts`100,${y - 12.5} 86,${y - 12} 79,${y - 2.5} 92,${y - 4.5} 100,${y - 6}`)]]);
	if (c.f.facialHair === 2)
		// A handlebar: wide, with both ends curled up.
		return fur(c, [
			[
				sym(
					pts`100,${y - 12} 88,${y - 13.5} 76,${y - 7} 70.5,${y - 1.5} 66.5,${y - 11} 62.5,${y - 3.5} 69,${y + 5.5} 78,${y + 2.5} 90,${y - 3.5} 100,${y - 5}`,
				),
			],
		]);
	return "";
}

function cheeks(c: Ctx): string
{
	const {w, ny} = c.g;
	const y = ny + 8,
		x = 100 - w * 0.52;
	switch (c.f.cheeks)
	{
		case 1:
			return layer(cut(c.dark ? "#e0607f" : "#f78fa7", both(ngon(x, y, 12.5, 8.5, 6, 0.1))));
		case 2:
		{
			let dots = "";
			for (const [a, e] of [
				[-8, -3],
				[-2, -5.5],
				[5, -3],
				[-5, 2],
				[1, 1],
				[8, 3],
				[-1, 6.5],
			] as const)
				dots += both(ngon(x + a, y + e, 2.6, 2.6, 4, a));
			return cut(c.tone, dots);
		}
		case 3:
		{
			// Two stripes of face paint on each cheek.
			const stripe = (dy: number): string => both(strip(pts`${x + 10},${y + dy} ${x - 9},${y + dy - 5}`, 4.8));
			return layer(cut("#3a78f2", stripe(-3) + stripe(6)));
		}
		case 4:
			return layer(
				`<g transform="rotate(-25 ${r1(x)} ${r1(y)})">` +
					cut(
						"#fdfaf2",
						d(
							pts`${x - 13},${y - 3.5} ${x - 11},${y - 5.5} ${x + 11},${y - 5.5} ${x + 13},${y - 3.5} ${x + 13},${y + 3.5} ${x + 11},${y + 5.5} ${x - 11},${y + 5.5} ${x - 13},${y + 3.5}`,
						),
					) +
					cut(
						"#dfa66c",
						d(pts`${x - 4.5},${y - 5.5} ${x + 4.5},${y - 5.5} ${x + 4.5},${y + 5.5} ${x - 4.5},${y + 5.5}`),
					) +
					"</g>",
			);
		case 5:
			return layer(cut("#ffd23f", star(200 - x, y, 14, 6.3)));
	}
	return "";
}

// The shirt's left edge at height y.
const sleeve = (y: number): number => 12 + ((254 - y) * 15) / 27;

// Every pattern spreads across the whole shirt, so neckwear never covers all of it.
function shirtPattern(c: Ctx): string
{
	const cloth = CLOTH[c.f.shirt]!;
	switch (c.f.shirtStyle)
	{
		case 1:
		{
			const band = (y: number): string =>
				d(
					pts`${sleeve(y) + 0.6},${y} ${200 - sleeve(y) - 0.6},${y} ${200 - sleeve(y + 4.4) - 0.6},${y + 4.4} ${sleeve(y + 4.4) + 0.6},${y + 4.4}`,
				);
			return layer(cut(shade(cloth, -0.45), band(233.4) + band(243.6)));
		}
		case 2:
		{
			let dots = "";
			for (const [i, [x, y]] of (
				[
					[30, 244],
					[50, 232],
					[68, 246],
					[84, 237],
				] as const
			).entries())
				dots += both(ngon(x, y, 4, 4, 5, i));
			return layer(cut(WHITE, dots));
		}
		case 3:
			return layer(cut(shade(cloth, -0.35), both(pts`12,254 27,227 60,218.5 46,254`)));
		case 4:
			return layer(cut("#3b3b45", both(pts`63.5,219 75.5,223 72,254 60,254`)));
		case 5:
		{
			const zig: Pt[] = [];
			for (let i = 0; i <= 12; i++) zig.push([18 + (i * 164) / 12, i % 2 ? 237 : 247.5]);
			return layer(cut(WHITE, d(strip(zig, 5))));
		}
	}
	return "";
}

function neckwear(c: Ctx): string
{
	switch (c.f.neckwear)
	{
		case 1:
			return (
				layer(cut("#2c3e50", both(pts`100,225 82.5,215.5 83.5,234.5`))) +
				layer(cut("#3f566e", d(ngon(100, 225, 5, 5.5, 6))))
			);
		case 2:
		{
			let pearls = "";
			for (let i = 0; i < 9; i++)
			{
				const a = Math.PI * (0.15 + (0.7 * i) / 8);
				pearls += d(ngon(100 - Math.cos(a) * 24, 214 + Math.sin(a) * 16, 4, 4, 6, i));
			}
			return layer(cut("#fffaf0", pearls));
		}
		case 3:
		{
			const tail: Pt[] = pts`82,228 74,254 77.2,248.5 80.4,254 83.6,248.5 86.8,254 90,248.5 93,254 95,231`;
			const bar = (x0: number, x1: number, y0: number, y1: number): string =>
				d(strip(pts`${x0},${y0} ${x1},${y1}`, 3.4));
			return (
				layer(cut("#f39c12", d(tail))) +
				layer(
					cut("#f39c12", d(pts`77,206 100,211.5 123,206 126,224 100,233 74,224`)) +
						cut(
							"#c0392b",
							bar(88, 86, 209.5, 228.5) + bar(100, 100, 211.5, 233) + bar(112, 114, 209.5, 228.5),
						),
				)
			);
		}
		case 4:
			return (
				layer(cut("#8e44ad", d(pts`96,231 104,231 111.5,254 88.5,254`))) +
				layer(
					cut(WHITE, both(pts`100,223.5 82.5,212.5 78.5,229.5 93,233.5`)) +
						cut("#7a3797", d(pts`92.5,220.5 107.5,220.5 104.5,232.5 95.5,232.5`)),
				)
			);
		case 5:
			return (
				layer(cut(GOLD, d(strip(pts`83,212 90,228 100,238 110,228 117,212`, 3)))) +
				layer(cut("#e5484d", d(pts`100,234.5 107.5,243 100,252.5 92.5,243`)))
			);
		case 6:
		{
			let dots = "";
			for (const [x, y] of [
				[90, 221],
				[110, 221],
				[100, 228.5],
				[100, 240],
			] as const)
				dots += d(ngon(x, y, 2.8, 2.8, 4, x));
			return layer(cut("#2f6fde", d(pts`74,209 100,216.5 126,209 100,251.5`)) + cut(WHITE, dots));
		}
	}
	return "";
}

function glasses(c: Ctx): string
{
	const {ey: y, ex} = c.g;
	const lx = 100 - ex,
		rx = 100 + ex;
	const paper = c.dark ? "#efe6d2" : "#24242c";
	// The bridge between the lenses and an arm from each lens to the side of the head.
	const arms = (reach: number, by: number): string =>
	{
		const side = 100 + edge(c, y - 6) + 1;
		return (
			both(pts`${rx + reach - 1},${y - 4} ${side},${y - 7.8} ${side},${y - 4.4} ${rx + reach - 1},${y - 0.4}`) +
			d(strip(pts`${lx + reach - 1},${y + by} 100,${y + by - 2.5} ${rx - reach + 1},${y + by}`, 3.2))
		);
	};
	switch (c.f.glasses)
	{
		case 1:
			return layer(holed(paper, pair(ngon(lx, y, 20, 20, 12, Math.PI / 12), 2.9)) + cut(paper, arms(19.5, -2)));
		case 2:
			return layer(
				holed(
					paper,
					pair(
						pts`${lx - 19.5},${y - 15} ${lx - 16},${y - 18.5} ${lx + 16.5},${y - 18.5} ${lx + 19.5},${y - 15.5} ${lx + 19.5},${y + 15} ${lx + 16},${y + 18.5} ${lx - 16},${y + 18.5} ${lx - 19.5},${y + 15}`,
						3,
					),
				) + cut(paper, arms(19.5, -3)),
			);
		case 3:
			// Aviators: thin gold teardrop frames with a top bar, and clear lenses like every other pair.
			return layer(
				holed(
					GOLD,
					pair(
						pts`${lx + 17.5},${y - 18.5} ${lx - 19},${y - 19.5} ${lx - 23.5},${y - 4} ${lx - 18},${y + 12} ${lx - 5},${y + 22.5} ${lx + 9.5},${y + 20} ${lx + 17},${y + 6}`,
						2.8,
					),
				) +
					cut(
						GOLD,
						arms(20, -5) +
							d(
								pts`${lx + 16},${y - 19.5} ${rx - 16},${y - 19.5} ${rx - 16},${y - 16.5} ${lx + 16},${y - 16.5}`,
							),
					),
			);
		case 4:
		{
			// A monocle on one eye, with a chain of links hanging from it.
			let chain = "";
			for (let i = 0; i < 6; i++)
			{
				const u = (i + 0.5) / 6;
				chain += d(
					ngon(
						rx + 13 * (1 - u) ** 2 + 44 * u * (1 - u) + 8 * u ** 2,
						y + 15 * (1 - u) ** 2 + 80 * u * (1 - u) + 62 * u ** 2,
						2.6,
						2.6,
						4,
						i % 2 ? 0 : Math.PI / 4,
					),
				);
			}
			return layer(holed(GOLD, frame(ngon(rx, y, 20.4, 20.4, 12, Math.PI / 12), 3.4)) + cut(GOLD, chain));
		}
		case 5:
		{
			// Cat-eye frames: the outer corners sweep up, and the lens stays wider than the largest eye.
			const lens: Pt[] = pts`${lx + 18.5},${y - 12} ${lx},${y - 19.5} ${lx - 28},${y - 25} ${lx - 24.5},${y - 4} ${lx - 17.5},${y + 13} ${lx - 3},${y + 19.5} ${lx + 12},${y + 17.5} ${lx + 18.5},${y + 5}`;
			return layer(holed("#ff4fa0", pair(lens, 3.2)) + cut("#ff4fa0", arms(22, -5)));
		}
	}
	return "";
}

// How far each hair style lifts a hat off the scalp.
const LIFT: Record<number, number> =
{
	1: 10,
	8: 8,
	2: 4,
	3: 4,
	12: 8,
	13: 4,
};

function hat(c: Ctx): string
{
	const {w, t, ey} = c.g;
	const afro = c.f.hairStyle === 4;
	const lift = LIFT[c.f.hairStyle] ?? 0;
	const hy = afro ? t + 34 - (w + 20) + 30 : t + 16 - lift;
	const hw = w + (afro ? 22 : 5);
	const col = HATC[c.f.hatColor]!;
	const dome = (width: number, h: number): Pt[] =>
		sym(
			pts`100,${hy - h - 2} ${100 - width * 0.34},${hy - h} ${100 - width * 0.72},${hy - h * 0.82} ${100 - width * 0.95},${hy - h * 0.46} ${100 - width},${hy}`,
		);
	// A band over the top of the head, for whatever is worn on one.
	const band = (fill: string): string => cut(fill, d(strip(over(c, ey - 4, 8, 2.5), 6.4)));
	switch (c.f.hat)
	{
		case 0:
			return "";
		case 1:
			return (
				layer(cut(col, d(dome(hw, 48)))) +
				layer(cut(WHITE, d(dome(hw * 0.5, 46))) + cut(col, d(ngon(100, hy - 50, 5, 4.5, 6)))) +
				layer(
					cut(
						shade(col, -0.22),
						d(
							sym(
								pts`100,${hy - 8} ${100 - hw + 2},${hy - 2.5} ${100 - hw - 6},${hy + 9} ${100 - hw * 0.5},${hy + 15} 100,${hy + 16}`,
							),
						),
					),
				)
			);
		case 2:
			return (
				layer(cut(col, d(dome(hw, 52)))) +
				layer(
					cut(
						shade(col, -0.2),
						d(
							pts`${100 - hw - 3},${hy - 13} ${100 + hw + 3},${hy - 12} ${100 + hw + 3},${hy + 4.5} ${100 - hw - 3},${hy + 3.5}`,
						),
					),
				) +
				layer(cut(WHITE, d(ngon(100, hy - 58, 10.5, 10.5, 8, 0.3))))
			);
		case 3:
			return (
				layer(
					cut(
						"#2d2d2d",
						d(
							pts`${100 - hw * 0.74},${hy - 61} ${100 + hw * 0.74},${hy - 63} ${100 + hw * 0.72},${hy} ${100 - hw * 0.72},${hy}`,
						),
					),
				) +
				layer(
					cut(
						col,
						d(
							pts`${100 - hw * 0.72},${hy - 20} ${100 + hw * 0.72},${hy - 21} ${100 + hw * 0.72},${hy - 8} ${100 - hw * 0.72},${hy - 8}`,
						),
					),
				) +
				layer(
					cut(
						"#2d2d2d",
						d(
							pts`${100 - hw - 14},${hy - 4} ${100 + hw + 14},${hy - 5} ${100 + hw + 11},${hy + 6.5} ${100 - hw - 11},${hy + 6.5}`,
						),
					),
				)
			);
		case 4:
			return (
				layer(
					cut(
						"#f5c542",
						d(
							sym(
								pts`100,${hy - 44} ${100 - hw * 0.45},${hy - 16} ${100 - hw * 0.86},${hy - 36} ${100 - hw * 0.8},${hy + 2}`,
							),
						),
					),
				) +
				layer(
					cut("#e74c3c", d(ngon(100, hy - 10, 5.5, 6.5, 4))) +
						cut("#3498db", both(ngon(100 - hw * 0.45, hy - 6, 4.5, 4.5, 4, Math.PI / 4))),
				)
			);
		case 5:
		{
			const bx = 100 - w * 0.5,
				by = t + 4 - (afro ? 20 : lift);
			return (
				layer(band(col)) +
				layer(
					cut(
						col,
						d(pts`${bx},${by} ${bx - 20},${by - 14} ${bx - 21},${by + 14}`) +
							d(pts`${bx},${by} ${bx + 21},${by - 14} ${bx + 20},${by + 14}`),
					),
				) +
				layer(cut(shade(col, -0.2), d(ngon(bx, by, 6.5, 6.5, 6))))
			);
		}
		case 6:
		{
			let dots = "";
			for (const [x, y] of [
				[96, 14],
				[110, 30],
				[104, 48],
				[116, 10],
				[86, 4],
			] as const)
				dots += d(ngon(x, hy - y, 3.8, 3.8, 4, x));
			return (
				layer(cut(col, d(pts`74,${hy} 106,${hy - 66} 130,${hy + 2}`))) +
				layer(cut(WHITE, dots + d(ngon(106, hy - 68, 7.5, 7.5, 7))))
			);
		}
		case 7:
			return (
				layer(cut(col, d(dome(hw, 50)))) +
				layer(
					cut("#f1c40f", d(pts`91.5,${hy} 93.5,${hy - 34} 100,${hy - 52} 106.5,${hy - 34} 108.5,${hy}`)) +
						cut("#3b3b45", d(pts`98.4,${hy - 51} 101.6,${hy - 51} 101.6,${hy - 65} 98.4,${hy - 65}`)),
				) +
				layer(
					cut("#f1c40f", both(pts`100,${hy - 66} 88,${hy - 71} 75.5,${hy - 66.5} 88,${hy - 61}`)) +
						cut(col, d(ngon(100, hy - 66, 4, 4, 6))),
				)
			);
		case 8:
			return (
				layer(
					cut(
						"#9a7650",
						d(
							sym(
								pts`100,${hy - 7.5} ${100 - hw - 10},${hy - 6.5} ${100 - hw - 21},${hy + 1} ${100 - hw - 8},${hy + 7.5} 100,${hy + 8}`,
							),
						),
					),
				) +
				layer(
					cut(
						"#a9845c",
						d(
							sym(
								pts`100,${hy - 45} ${100 - hw * 0.4},${hy - 51} ${100 - hw * 0.84},${hy - 41} ${100 - hw * 0.78},${hy} 100,${hy}`,
							),
						),
					) +
						cut(
							col,
							d(
								pts`${100 - hw * 0.8},${hy - 15} ${100 + hw * 0.8},${hy - 15.5} ${100 + hw * 0.78},${hy - 3} ${100 - hw * 0.78},${hy - 3}`,
							),
						),
				)
			);
		case 9:
			return (
				layer(cut("#3b3b45", d(strip(pts`105,${hy - 44} 109.5,${hy - 57}`, 3.6)))) +
				layer(
					cut(
						col,
						d(
							pts`${100 - hw - 10},${hy - 8} ${100 - hw - 5},${hy - 30} ${100 - hw * 0.4},${hy - 45} ${100 + hw * 0.5},${hy - 46} ${100 + hw + 19},${hy - 31} ${100 + hw + 13},${hy - 6} 100,${hy + 2}`,
						),
					),
				) +
				layer(
					cut(
						shade(col, -0.22),
						d(
							pts`${100 - hw + 2},${hy - 6} 100,${hy + 3.5} ${100 + hw - 2},${hy - 4} ${100 + hw - 2},${hy + 3} 100,${hy + 11.5} ${100 - hw + 2},${hy + 1}`,
						),
					),
				)
			);
	}
	// Cat ears and devil horns stand on a band.
	const by = t + 6 - (afro ? 20 : lift),
		x = 100 - w * 0.55;
	if (c.f.hat === 10)
		return (
			layer(
				cut("#2b2b2b", both(pts`${x - 21},${by + 6} ${x - 6},${by - 44} ${x + 21},${by + 6}`)) +
					cut("#ffb3c7", both(pts`${x - 11},${by + 1} ${x - 5},${by - 28} ${x + 11},${by + 1}`)),
			) + layer(band("#2b2b2b"))
		);
	return (
		layer(
			cut(
				"#d92b2b",
				both(
					pts`${x + 10},${by + 5} ${x + 6},${by - 12} ${x - 6},${by - 28} ${x - 20},${by - 38} ${x - 18},${by - 20} ${x - 10},${by + 5}`,
				),
			),
		) + layer(band("#d92b2b"))
	);
}

function paint(f: Face): string
{
	const hc = HAIRC[f.hairColor]!;
	const c: Ctx =
	{
		f,
		g: geo(f),
		sk: SKIN[f.skin]!,
		hc,
		// Dye colors the hair on the head; eyebrows and facial hair keep the natural color.
		dye: f.hairDye ? DYEC[f.hairDye]! : hc,
		tone: TONE[f.skin]!,
		dark: f.skin >= 3,
	};
	const cloth = CLOTH[f.shirt]!;
	const head = Array.from(
		{
			length: 18,
		},
		(_, i) => hp(c, Math.PI / 2 + (i * Math.PI) / 9),
	);
	return (
		hairBack(c) +
		// The neck runs down behind the shirt, so no gap ever opens between them.
		layer(cut(shade(c.sk, c.dark ? -0.22 : -0.14), d(pts`87,${c.g.b - 16} 113,${c.g.b - 16} 115,234 85,234`))) +
		layer(cut(cloth, d(pts`12,254 27,227 62,218 100,231 138,218 173,227 188,254`))) +
		shirtPattern(c) +
		neckwear(c) +
		layer(ears(c)) +
		layer(earrings(c)) +
		layer(cut(c.sk, d(head))) +
		cheeks(c) +
		beard(c) +
		hairFront(c) +
		layer(eyes(c)) +
		brows(c) +
		layer(nose(c) + mouth(c)) +
		mustache(c) +
		glasses(c) +
		hat(c)
	);
}

// Scissor-cut construction paper: flat faceted shapes, no outlines, and a grain and a small shadow on every layer.
export const paper: ArtStyle =
{
	id: "paper",
	name: "Cut Paper",
	blurb: "Scissor-cut construction paper with shadows.",
	defs:
		'<filter id="paper-cut" x="-15%" y="-25%" width="130%" height="175%" color-interpolation-filters="sRGB">' +
		'<feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="3" result="n"/>' +
		'<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.48 .31" result="g"/>' +
		'<feComposite in="g" in2="SourceAlpha" operator="in" result="grain"/>' +
		'<feMerge result="tex"><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge>' +
		'<feDropShadow in="tex" dx=".6" dy="2" stdDeviation="1.1" flood-color="#000" flood-opacity=".38"/>' +
		"</filter>",
	paint,
};
