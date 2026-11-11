import {CLOTH, DYEC, EYEC, type Face, HAIRC, HATC, SKIN} from "../faces.ts";
import {geo, type Geo, headHalf, shade, star} from "../geometry.ts";
import type {ArtStyle} from "./style.ts";

// Creases pressed into the skin (nose shadows, ear folds, pucker lines) and the thin bed under hair that lies on the
// skin. A darker skin tone on the light skins; on the two darkest, where dark on dark vanishes, a lighter one.
const CREASE = [shade(SKIN[0]!, -0.42), shade(SKIN[1]!, -0.5), shade(SKIN[2]!, -0.64), "#e8bd92", "#c9905f"];
// The crease beside a nose: CREASE, but on the two darkest skins a softer tone pressed thinner, so the nose stays subtle.
const NOSE_CREASE = [CREASE[0]!, CREASE[1]!, CREASE[2]!, "#e0b48a", "#c08957"];
// Lips and mouth grooves: deep red clay on the light skins, rose on the dark ones.
const LIP = ["#7a2432", "#7a2432", "#5a1826", "#f4a79b", "#ea9a8d"];
const MOUTH_INSIDE = "#4d1521";
const TOOTH = "#ffffff";
const POMPOM = "#fbf6ec";
const TIE_RED = "#ff4d6d";
const GOLD = "#e6b422";
const darkSkin = (f: Face): boolean => f.skin >= 3;

type Value = string | number;
const fmt = (v: Value): string => (typeof v === "number" ? String(Math.round(v * 10) / 10) : v);
// Markup with every number rounded to one decimal.
function svg(strings: TemplateStringsArray, ...values: Value[]): string
{
	let out = strings[0]!;
	for (const [i, v] of values.entries()) out += fmt(v) + strings[i + 1]!;
	return out;
}

// Every piece of clay is a filtered group: the filter rounds its edge, lights it from the top left and drops a soft
// shadow on the piece below. Big pieces and small pieces get a bevel of their own size.
const big = (s: string): string => (s ? `<g filter="url(#clay-big)">${s}</g>` : "");
const small = (s: string): string => (s ? `<g filter="url(#clay-small)">${s}</g>` : "");
const ball = (x: number, y: number, r: number, fill: string): string =>
	svg`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const sausage = (d: string, color: string, width: number): string =>
	svg`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
// A filled shape with its corners rolled round.
const slab = (d: string, fill: string, round = 3): string =>
	svg`<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="${round}" stroke-linejoin="round"/>`;
type Ball = [number, number, number];
// Neighbouring balls go into two groups, so each is lit as a lump of its own instead of melting into the next.
function lumps(balls: Ball[], fill: string, wrap: (s: string) => string): string
{
	const half = (odd: number): string =>
		balls
			.filter((_, i) => i % 2 === odd)
			.map(([x, y, r]) => ball(x, y, r, fill))
			.join("");
	return wrap(half(0)) + wrap(half(1));
}
const channels = (hex: string): number[] =>
{
	const n = parseInt(hex.slice(1), 16);
	return [n >> 16, (n >> 8) & 255, n & 255];
};
// The color of a groove pressed into a piece: darker, or lighter when the piece is nearly black.
const deep = (c: string): string => shade(c, channels(c).reduce((sum, v) => sum + v, 0) < 200 ? 0.24 : -0.2);
// Hair that lies on the skin. Where its color is close to the skin's (always, on the two darkest skins) it sits on a
// thin bed of the crease color, or it would vanish.
function bedded(f: Face, color: string): boolean
{
	const skin = channels(SKIN[f.skin]!);
	return darkSkin(f) || channels(color).reduce((sum, v, i) => sum + Math.abs(v - skin[i]!), 0) < 150;
}
function onSkin(f: Face, shapes: string, color: string, round = 0): string
{
	const rolled = (c: string, width: number): string =>
		svg`<g fill="${c}" stroke="${c}" stroke-width="${width}" stroke-linejoin="round">${shapes}</g>`;
	return (bedded(f, color) ? rolled(CREASE[f.skin]!, round + 2.6) : "") + rolled(color, round);
}
function sausageOnSkin(f: Face, d: string, color: string, width: number): string
{
	return (bedded(f, color) ? sausage(d, CREASE[f.skin]!, width + 2.6) : "") + sausage(d, color, width);
}
const oval = (cx: number, cy: number, rx: number, ry: number): string =>
	svg`M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const shine = (x: number, y: number): string =>
	svg`<ellipse cx="${x}" cy="${y}" rx="14" ry="6" transform="rotate(-22 ${x} ${y})" fill="#fff" opacity=".5"/>`;

function head(f: Face, g: Geo, fill: string): string
{
	const {w, t, b, cy, ry, L, R} = g;
	if (f.faceShape === 2)
		return svg`<rect x="${L}" y="${t}" width="${2 * w}" height="${b - t}" rx="28" fill="${fill}"/>`;
	if (f.faceShape === 4)
		return svg`<path fill="${fill}" d="M${L} ${t + 50} Q${L} ${t} 100 ${t} Q${R} ${t} ${R} ${t + 50} Q${R - 4} ${b - 40} 100 ${b} Q${L + 4} ${b - 40} ${L} ${t + 50}Z"/>`;
	return svg`<ellipse cx="100" cy="${cy}" rx="${w}" ry="${ry}" fill="${fill}"/>`;
}

function hairBack(f: Face, g: Geo, hc: string): string
{
	const {w, t, ey, L, R} = g;
	switch (f.hairStyle)
	{
		case 2:
			return big(
				svg`<rect fill="${hc}" x="${L - 12}" y="${t - 8}" width="${2 * w + 24}" height="${ey + 48 - t}" rx="34"/>`,
			);
		case 3:
			return big(
				slab(
					svg`M${L - 13} ${t + 34} Q${L - 15} ${t - 11} 100 ${t - 11} Q${R + 15} ${t - 11} ${R + 13} ${t + 34} L${R + 21} 236 Q100 246 ${L - 21} 236Z`,
					hc,
				),
			);
		case 4:
		{
			const cy = t + 34,
				r = w + 20;
			const rim: Ball[] = [];
			for (let i = 0; i < 14; i++)
			{
				const a = Math.PI * (0.8 + (i * 1.4) / 13);
				rim.push([100 + Math.cos(a) * r, cy + Math.sin(a) * r, 15]);
			}
			return big(ball(100, cy, r, hc)) + lumps(rim, hc, big);
		}
		case 5:
		{
			// A ponytail of four lumps, each smaller than the last, swinging out from its tie.
			const tail: Ball[] = [
				[R + 27, t + 39, 16],
				[R + 20.5, t + 56, 15],
				[R + 13.5, t + 73, 13.5],
				[R + 7, t + 89, 11],
			];
			return lumps(tail, hc, big) + small(ball(R + 4, t + 32, 7.5, TIE_RED));
		}
		case 7:
		{
			// Two buns, each a coil with its groove pressed in.
			const coil = (x: number, y: number): string =>
				svg`M${x - 14} ${y} A14 14 0 0 1 ${x + 14} ${y} A11 11 0 0 1 ${x - 8} ${y} A6.5 6.5 0 0 1 ${x + 5} ${y} A3.5 3.5 0 0 1 ${x - 2} ${y}`;
			return (
				big(ball(L + 4, t + 2, 23, hc)) +
				big(ball(R - 4, t + 2, 23, hc)) +
				sausage(coil(L + 4, t + 2) + coil(R - 4, t + 2), deep(hc), 2.4)
			);
		}
		case 11:
		{
			// Two braids hang beside the neck, each a chain of knots with a tie at the end.
			let o = "";
			for (const x of [L - 9, R + 9])
			{
				const knots: Ball[] = [];
				for (let i = 0; i < 5; i++) knots.push([x + (i % 2 ? 2.5 : -2.5), ey + 28 + i * 15, 10.5]);
				o += lumps(knots, hc, small) + small(ball(x, ey + 102, 6.5, TIE_RED));
			}
			return o;
		}
	}
	return "";
}
function hairFront(f: Face, g: Geo, hc: string): string
{
	const {w, t, ey, L, R, cy, ry} = g;
	const fb = ey - 28;
	const P = (th: number, e = 0): [number, number] => [
		100 + (w + 3 + e) * Math.cos(th),
		cy + (ry + 3 + e) * Math.sin(th),
	];
	const cap = svg`M${L - 3} ${ey - 8} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 3} ${ey - 8}`;
	const parted = svg`${cap} Q${R - 4} ${fb} 106 ${fb - 6} L100 ${t + 6} L94 ${fb - 6} Q${L + 4} ${fb} ${L - 3} ${ey - 8}Z`;
	switch (f.hairStyle)
	{
		case 0:
			return shine(100 - w * 0.36, t + 20);
		case 1:
		{
			// A crown of rolled cones, and a jagged fringe.
			const pts: [number, number][] = [[L - 3, ey - 12]];
			for (let i = 0; i <= 12; i++) pts.push(P(Math.PI * (1.08 + (0.84 * i) / 12), i % 2 ? 20 : 0));
			pts.push([R + 3, ey - 12]);
			for (let i = 0; i <= 7; i++) pts.push([R - 4 - ((2 * w - 8) * i) / 7, i % 2 ? fb - 9 : fb]);
			return big(slab("M" + pts.map(([x, y]) => svg`${x} ${y}`).join(" L") + "Z", hc, 4));
		}
		case 2:
			return big(
				slab(
					svg`M${L - 4} ${ey - 4} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 4} ${ey - 4} L${R - 6} ${ey - 6} L${R - 8} ${fb} L${L + 8} ${fb} L${L + 6} ${ey - 6}Z`,
					hc,
					2,
				),
			);
		case 3:
			return big(
				svg`<path fill="${hc}" d="M${L - 4} ${ey + 6} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 4} ${ey + 6} Q${R - 4} ${fb} ${R - 20} ${fb - 2} Q100 ${fb - 6} 84 ${t + 10} Q${L + 12} ${fb + 4} ${L + 5} ${ey + 6}Z"/>`,
			);
		case 4:
			return big(
				svg`<path fill="${hc}" d="M${L - 2} ${ey - 10} C${L - 6} ${t - 28} ${R + 6} ${t - 28} ${R + 2} ${ey - 10} Q${R - 6} ${fb} 100 ${fb - 8} Q${L + 6} ${fb} ${L - 2} ${ey - 10}Z"/>`,
			);
		case 5:
			return big(
				svg`<path fill="${hc}" d="${cap} Q${R - 2} ${fb + 2} ${R - 14} ${fb} Q100 ${fb - 16} ${L + 14} ${fb} Q${L + 2} ${fb + 2} ${L - 3} ${ey - 8}Z"/>`,
			);
		case 6:
			return big(
				slab(
					svg`M88 ${t + 26} L85 ${t - 6} L92 ${t - 22} L96 ${t - 13} L100 ${t - 38} L104 ${t - 13} L108 ${t - 22} L115 ${t - 6} L112 ${t + 26}Z`,
					hc,
					5,
				),
			);
		case 7:
		case 11:
			return big(svg`<path fill="${hc}" d="${parted}"/>`);
		case 8:
		{
			// The curls stop above the ears, so ears and earrings stay in sight.
			const curls: Ball[] = [];
			for (let i = 0; i < 11; i++) curls.push([...P(Math.PI * (1.15 + (i * 0.7) / 10), 2), 11]);
			return (
				big(
					svg`<path fill="${hc}" d="M${L - 2} ${ey - 10} C${L - 6} ${t - 28} ${R + 6} ${t - 28} ${R + 2} ${ey - 10} Q${R - 6} ${fb} 100 ${fb - 6} Q${L + 6} ${fb} ${L - 2} ${ey - 10}Z"/>`,
				) + lumps(curls, hc, small)
			);
		}
		case 9:
		{
			// Balding: a tuft over each ear and a bare, shiny top.
			const side = (x: number, s: number): string =>
				svg`M${x - s * 4} ${ey + 2} C${x - s * 12} ${t + 30} ${x + s * 2} ${t + 10} ${x + s * 17} ${t + 15} Q${x + s * 8} ${t + 40} ${x + s * 9} ${ey + 2}Z`;
			return shine(100 - w * 0.2, t + 16) + small(slab(side(L, 1), hc)) + small(slab(side(R, -1), hc));
		}
		case 10:
			// A side part: the hair piles high on one side and sweeps down across the forehead.
			return big(
				svg`<path fill="${hc}" d="M${L - 3} ${ey - 8} C${L - 6} ${t - 14} ${L + 18} ${t - 22} ${L + 24} ${t - 8} C${L + 40} ${t - 44} ${R + 16} ${t - 40} ${R + 3} ${ey - 8} Q${R - 2} ${fb + 6} ${R - 14} ${fb + 6} Q100 ${fb - 2} ${L + 24} ${t + 8} Q${L + 10} ${fb - 6} ${L - 3} ${ey - 8}Z"/>`,
			);
		case 12:
			// A flat-top: straight sides and a level top.
			return big(
				slab(
					svg`M${L - 2} ${ey - 8} L${L - 5} ${t - 23} L${R + 5} ${t - 23} L${R + 2} ${ey - 8} Q${R - 4} ${fb + 2} 100 ${fb - 4} Q${L + 4} ${fb + 2} ${L - 2} ${ey - 8}Z`,
					hc,
					2,
				),
			);
		case 13:
			// A bowl cut: a round cap with a straight fringe just above the eyebrows.
			return (
				big(
					slab(
						svg`M${L - 5} ${ey - 2} C${L - 12} ${t - 34} ${R + 12} ${t - 34} ${R + 5} ${ey - 2} L${R - 5} ${ey - 2} L${R - 6} ${fb + 5} L${L + 6} ${fb + 5} L${L + 5} ${ey - 2}Z`,
						hc,
						2,
					),
				) + shine(100 - w * 0.3, t - 2)
			);
	}
	return "";
}

function ears(f: Face, g: Geo, sk: string): string
{
	const {w, ey} = g;
	const y = ey + 10;
	const fold = darkSkin(f) ? shade(sk, 0.2) : shade(sk, -0.2);
	const EB = [
		[5, 14],
		[9, 21],
		[8, 14],
		[14, 9],
	];
	let lobes = "",
		rings = "";
	for (const s of [-1, 1])
	{
		const x = 100 + s * (w - 3);
		switch (f.ears)
		{
			case 0:
				lobes += svg`<ellipse cx="${x + s * 5}" cy="${y}" rx="10" ry="14"/><ellipse cx="${x + s * 8}" cy="${y}" rx="3" ry="7" fill="${fold}"/>`;
				break;
			case 1:
				lobes += svg`<ellipse cx="${x + s * 9}" cy="${y}" rx="15" ry="21"/><ellipse cx="${x + s * 13}" cy="${y}" rx="5" ry="11" fill="${fold}"/>`;
				break;
			case 2:
				lobes += svg`<path d="M${x} ${y - 10} Q${x + s * 14} ${y - 18} ${x + s * 24} ${y - 30} Q${x + s * 18} ${y - 4} ${x + s * 8} ${y + 14} Q${x + s * 2} ${y + 16} ${x} ${y + 10}Z"/>`;
				break;
			case 3:
				lobes += svg`<g transform="rotate(${-s * 25} ${x + s * 14} ${y})"><ellipse cx="${x + s * 14}" cy="${y}" rx="16" ry="11"/><ellipse cx="${x + s * 18}" cy="${y}" rx="8" ry="4.5" fill="${fold}"/></g>`;
				break;
		}
		if (f.earrings)
		{
			const [dx, dy] = EB[f.ears] as [number, number];
			const ex = x + s * dx,
				ey2 = y + dy;
			rings += [
				svg`<circle cx="${ex}" cy="${ey2 + 7}" r="7.5" fill="none" stroke="${GOLD}" stroke-width="4"/>`,
				svg`<path d="M${ex} ${ey2} q-11 15 0 19 q11 -4 0 -19Z" fill="#2fb7ee"/>`,
				ball(ex, ey2 + 6, 8, "#e5484d"),
				slab(svg`M${ex} ${ey2} l-8 17 h16Z`, "#33b565", 3),
			][f.earrings - 1]!;
		}
	}
	return small(`<g fill="${shade(sk, -0.07)}">${lobes}</g>`) + small(rings);
}

// White radius, iris radius, pupil radius and how far the iris looks to the side.
const EYE = [
	[10, 6.8, 3, 0],
	[14, 9.5, 4.2, 0],
	[11, 7, 3, 0],
	[0, 6.3, 2.8, 0],
	[10, 6.8, 3, 0],
	[11, 7, 3, 4],
] as const;
function eyes(f: Face, g: Geo, sk: string): string
{
	const ic = EYEC[f.eyeColor]!;
	const [r, ir, pr, dx] = EYE[f.eyes]!;
	const y = g.ey;
	const lid = darkSkin(f) ? shade(sk, 0.16) : shade(sk, -0.13);
	const lash = darkSkin(f) ? CREASE[f.skin]! : "#2a2430";
	let whites = "",
		irises = "",
		lids = "";
	for (const s of [-1, 1])
	{
		const x = 100 + s * g.ex;
		const almond = f.eyes === 3;
		// The almond eye looks straight ahead; the round ones a little down, like the notebook's.
		const iy = almond ? y : y + 1;
		whites += almond
			? svg`<path d="M${x - 15} ${y} Q${x} ${y - 12} ${x + 15} ${y} Q${x} ${y + 12} ${x - 15} ${y}Z" fill="#fff"/>`
			: ball(x, y, r, "#fff");
		irises +=
			svg`<circle cx="${x + dx}" cy="${iy}" r="${ir - 0.5}" fill="${ic}" stroke="${shade(ic, -0.35)}" stroke-width="1"/>` +
			ball(x + dx, iy, pr, "#16141f") +
			ball(x + dx - ir * 0.38, iy - ir * 0.38, Math.max(1.4, ir * 0.26), "#fff");
		if (f.eyes === 2)
			lids += svg`<path d="M${x - 11.8} ${y - 2} A12 12 0 0 1 ${x + 11.8} ${y - 2}Z" fill="${lid}"/>`;
		if (f.eyes === 4)
		{
			lids +=
				sausage(svg`M${x - 10} ${y - 2} A10.2 10.2 0 0 1 ${x + 10} ${y - 2}`, "#2a2430", 4) +
				sausage(
					svg`M${x + s * 4} ${y - 10} l${s * 4} -6 M${x + s * 8} ${y - 7} l${s * 8} -4 M${x + s * 10} ${y - 2} l${s * 9} 0 M${x - s * 2} ${y - 11} l0 -6`,
					lash,
					3,
				);
		}
	}
	return small(whites) + irises + small(lids);
}
function brows(f: Face, g: Geo, hc: string): string
{
	const {ey, ex} = g;
	// Glasses push the eyebrows up, so no frame ever sits on top of them.
	const y = ey - (f.eyes === 1 ? 22 : 18) - (f.glasses ? 7 : 0);
	const one = (s: number): string =>
	{
		const x = 100 + s * ex,
			xo = x + s * 12,
			xi = x - s * 11;
		switch (f.eyebrows)
		{
			case 0:
				return svg`M${xi} ${y + 1} Q${x} ${y - 6} ${xo} ${y + 2}`;
			case 1:
				return svg`M${xi} ${y - 1} L${xo} ${y - 1}`;
			case 2:
				return svg`M${xo} ${y - 4} L${xi} ${y + 4}`;
			case 3:
				return svg`M${xo} ${y + 3} L${xi} ${y - 5}`;
			case 5:
				return s < 0
					? svg`M${xi} ${y - 5} Q${x} ${y - 17} ${xo} ${y - 4}`
					: svg`M${xi} ${y + 3} L${xo} ${y + 1}`;
		}
		return "";
	};
	const d =
		f.eyebrows === 4
			? svg`M${100 - ex - 13} ${y + 1} Q${100 - ex} ${y - 6} 100 ${y} Q${100 + ex} ${y - 6} ${100 + ex + 13} ${y + 1}`
			: one(-1) + " " + one(1);
	return small(sausageOnSkin(f, d, hc, f.eyebrows === 1 ? 11 : f.eyebrows === 4 ? 7.5 : 6.5));
}

// A nose is a lump of skin clay with the crease its shadow side presses into the face.
function nose(f: Face, g: Geo, sk: string): string
{
	const y = g.ny;
	const dark = darkSkin(f);
	const lump = dark ? shade(sk, 0.1) : shade(sk, -0.09);
	const crease = (d: string): string => sausage(d, NOSE_CREASE[f.skin]!, dark ? 2.8 : 3.2);
	switch (f.nose)
	{
		case 0:
			return small(ball(100, y, 5.5, lump)) + crease(svg`M94.5 ${y - 0.5} Q100 ${y + 8.5} 105.5 ${y - 0.5}`);
		case 1:
			return (
				small(slab(svg`M101.5 ${y - 13} L95.5 ${y + 2.5} L103.5 ${y + 2.5}Z`, lump)) +
				crease(svg`M101 ${y - 16} L94 ${y + 4} L104.5 ${y + 4}`)
			);
		case 2:
			return (
				small(
					svg`<ellipse cx="102.5" cy="${y - 8}" rx="4.5" ry="11.5" fill="${lump}"/>` +
						ball(102, y + 2, 5, lump),
				) + crease(svg`M100 ${y - 20} Q103 ${y - 2} 97 ${y + 5} Q101 ${y + 9} 106 ${y + 4}`)
			);
		case 3:
			return (
				small(ball(100, y, 10, dark ? shade(sk, 0.16) : shade(sk, -0.15))) +
				crease(svg`M91.3 ${y + 5} A10 10 0 0 0 109.4 ${y - 3.4}`)
			);
		case 4:
			return (
				small(
					svg`<path fill="${dark ? shade(sk, 0.2) : shade(sk, -0.1)}" d="M97 ${y - 18} Q115 ${y - 2} 106 ${y + 6} Q100 ${y + 8} 95 ${y + 4}Z"/>`,
				) + crease(svg`M97 ${y - 18} Q115 ${y - 2} 106 ${y + 6} Q100 ${y + 8} 95 ${y + 4}`)
			);
		case 5:
			return (
				small(ball(90.5, y - 1.5, 5, lump) + ball(109.5, y - 1.5, 5, lump) + ball(100, y - 1, 6, lump)) +
				crease(svg`M87 ${y + 2} Q90 ${y - 7} 95 ${y + 1} Q100 ${y + 6} 105 ${y + 1} Q110 ${y - 7} 113 ${y + 2}`)
			);
		case 6:
			return (
				crease(svg`M90.5 ${y + 4.5} Q100 ${y + 13} 109.5 ${y + 4.5}`) +
				small(svg`<ellipse cx="100" cy="${y}" rx="11" ry="8" fill="#f7a1b0"/>`) +
				svg`<ellipse cx="96" cy="${y}" rx="2.4" ry="3.5" fill="#5a2a30"/><ellipse cx="104" cy="${y}" rx="2.4" ry="3.5" fill="#5a2a30"/>`
			);
	}
	return "";
}
// Mouths are grooves pressed into the face, or holes cut out of it with a rolled lip.
function mouth(f: Face, g: Geo): string
{
	const y = g.my;
	const lip = LIP[f.skin]!;
	const groove = (d: string): string => sausage(d, lip, 4.6);
	const hole = (d: string): string =>
		svg`<path d="${d}" fill="${MOUTH_INSIDE}" stroke="${lip}" stroke-width="3" stroke-linejoin="round"/>`;
	switch (f.mouth)
	{
		case 0:
			return groove(svg`M86 ${y} Q100 ${y + 13} 114 ${y}`);
		case 1:
			return (
				hole(svg`M84 ${y - 2} L116 ${y - 2} Q114 ${y + 18} 100 ${y + 18} Q86 ${y + 18} 84 ${y - 2}Z`) +
				svg`<ellipse cx="100" cy="${y + 13.5}" rx="8" ry="3.8" fill="#f0808c"/>` +
				small(svg`<rect x="87.5" y="${y - 1.5}" width="25" height="7.5" rx="3" fill="${TOOTH}"/>`)
			);
		case 2:
			return groove(svg`M87 ${y + 9} Q100 ${y - 4} 113 ${y + 9}`);
		case 3:
			return hole(oval(100, y + 5, 8, 10));
		case 4:
			return groove(svg`M88 ${y + 4} L112 ${y + 4}`);
		case 5:
			return (
				hole(svg`M86.5 ${y} Q100 ${y + 4} 113.5 ${y} Q100 ${y + 18} 86.5 ${y}Z`) +
				small(
					svg`<path fill="#ff7a8a" d="M94.5 ${y + 7} Q94.5 ${y + 22} 100.5 ${y + 22} Q106.5 ${y + 22} 106.5 ${y + 7}Z"/>`,
				) +
				sausage(svg`M100.5 ${y + 10} V${y + 16.5}`, "#d9506a", 1.8)
			);
		case 6:
			return groove(svg`M87 ${y + 5} Q104 ${y + 7} 114 ${y - 4}`);
		case 7:
			return (
				groove(svg`M86 ${y} Q100 ${y + 9} 114 ${y}`) +
				svg`<rect x="91" y="${y + 2.5}" width="18" height="13.5" rx="3.5" fill="${MOUTH_INSIDE}"/>` +
				small(
					svg`<rect x="92.6" y="${y + 3}" width="7" height="11.6" rx="2" fill="${TOOTH}"/><rect x="100.4" y="${y + 3}" width="7" height="11.6" rx="2" fill="${TOOTH}"/>`,
				)
			);
		case 8:
			// Puckered lips, with a crease at each side.
			return (
				sausage(
					svg`M85 ${y + 1} l-5 -3 M85 ${y + 8} l-5 3 M115 ${y + 1} l5 -3 M115 ${y + 8} l5 3`,
					CREASE[f.skin]!,
					2.6,
				) +
				small(
					svg`<path fill="#e0455a" d="M90 ${y + 4} Q95 ${y - 5} 100 ${y + 1} Q105 ${y - 5} 110 ${y + 4} Q107 ${y + 16} 100 ${y + 16} Q93 ${y + 16} 90 ${y + 4}Z"/>`,
				) +
				sausage(svg`M91.5 ${y + 4.5} Q100 ${y + 9} 108.5 ${y + 4.5}`, "#9c2438", 2.2)
			);
	}
	return "";
}

// Stubble: the same scatter of dots on every face.
const STUBBLE = ((): [number, number][] =>
{
	let s = 11;
	const r = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
	const a: [number, number][] = [];
	while (a.length < 46)
	{
		const u = r() * 2 - 1,
			v = r();
		if (Math.abs(u) < 1 - v * 0.55 && !(Math.abs(u) < 0.34 && v < 0.32)) a.push([u, v]);
	}
	return a;
})();
function beard(f: Face, g: Geo, hc: string): string
{
	const {L, R, b, ey, ny, my, w} = g;
	const y = my;
	switch (f.facialHair)
	{
		case 3:
		{
			// The full beard starts below the cheeks and has a hole for the mouth, so both show on any hair color.
			// A row of lumps follows the jaw, just inside the edge.
			const tufts: Ball[] = [];
			for (const u of [0.34, 0.56, 0.78, 1, 1.22, 1.44, 1.66])
			{
				const v = u <= 1 ? u : 2 - u,
					s = u <= 1 ? -1 : 1;
				const x = (1 - v) * (1 - v) * (w - 3) + 2 * v * (1 - v) * (w - 2),
					by = (1 - v) * (1 - v) * (ny + 18) + 2 * v * (1 - v) * (b + 2) + v * v * (b + 10);
				tufts.push([100 + s * x * 0.86, by - 5 - 4 * v, 8]);
			}
			return (
				big(
					onSkin(
						f,
						svg`<path fill-rule="evenodd" d="M${L + 3} ${ny + 18} Q${L + 2} ${b + 2} 100 ${b + 10} Q${R - 2} ${b + 2} ${R - 3} ${ny + 18} Q${R - 12} ${ny + 22} 122 ${my - 6} Q100 ${my - 14} 78 ${my - 6} Q${L + 12} ${ny + 22} ${L + 3} ${ny + 18}Z ${oval(100, my + 8, 21, 14)}"/>`,
						hc,
					),
				) + lumps(tufts, hc, small)
			);
		}
		case 4:
		{
			// A soul patch, long enough to show under the widest grin.
			const low = Math.min(y + 31, b - 2);
			return small(
				onSkin(
					f,
					svg`<path d="M89 ${y + 10} Q100 ${y + 6} 111 ${y + 10} L107 ${low} Q100 ${low + 5} 93 ${low}Z"/>`,
					hc,
					2,
				),
			);
		}
		case 5:
		{
			const dot = darkSkin(f) ? shade(hc, 0.5) : shade(hc, -0.4);
			return STUBBLE.map(([u, v]) => ball(100 + u * w * 0.75, my - 6 + v * (b - my + 2), 1.5, dot)).join("");
		}
		case 6:
		{
			// Sideburns start under the hair, so they join it, and run to the jaw short of the cheeks.
			const side = (x: number, s: number): string =>
				svg`M${x - s * 3} ${ey - 18} L${x + s * 15} ${ey - 18} L${x + s * 17} ${ny + 14} Q${x + s * 11} ${ny + 27} ${x + s * 4} ${ny + 20}Z`;
			return small(onSkin(f, `<path d="${side(L, 1)} ${side(R, -1)}"/>`, hc));
		}
		case 7:
		{
			// A goatee circles the mouth: mustache, chin and the strips that join them.
			const low = Math.min(y + 34, b + 5);
			return small(
				onSkin(
					f,
					svg`<path fill-rule="evenodd" d="M79 ${y - 8} Q100 ${y - 19} 121 ${y - 8} L122 ${y + 17} Q100 ${low + 4} 78 ${y + 17}Z ${oval(100, y + 6, 15, 10)}"/>`,
					hc,
				),
			);
		}
		case 8:
		{
			// Mutton chops: full sideburns that widen under the cheeks, follow the jaw and sweep up into a mustache,
			// leaving the chin bare.
			let low = y + 24;
			while (headHalf(f, g, low) < w * 0.4) low--;
			const chop = (s: number): string =>
			{
				const X = (dx: number): number => 100 - s * dx;
				let jaw = "";
				for (let i = 0; i <= 4; i++)
				{
					const h = low + ((ny + 8 - low) * i) / 4;
					jaw += svg` L${X(headHalf(f, g, h) - 1)} ${h}`;
				}
				return (
					svg`M${X(w + 3)} ${ey - 18} L${X(w * 0.7)} ${ey - 18} L${X(w * 0.72)} ${ny + 14} Q${X(w * 0.72)} ${ny + 24} ${X(w * 0.5)} ${ny + 25}` +
					svg` L${X(13)} ${y - 10} Q${X(6)} ${y - 14} 100 ${y - 9} L100 ${y - 3} Q${X(14)} ${y - 1} ${X(w * 0.36)} ${y + 9}` +
					svg` Q${X(w * 0.36)} ${low} ${X(headHalf(f, g, low) - 1)} ${low}${jaw}Z`
				);
			};
			return small(onSkin(f, `<path d="${chop(1)} ${chop(-1)}"/>`, hc, 2));
		}
		case 9:
			// A chin strap: one thin roll of beard along the jaw, ear to ear.
			return small(
				sausageOnSkin(
					f,
					svg`M${L + 4} ${ny + 4} Q${L + 6} ${b - 8} 100 ${b - 4} Q${R - 6} ${b - 8} ${R - 4} ${ny + 4}`,
					hc,
					8,
				),
			);
		case 10:
			// A long chin beard that hangs to a point below the chin.
			return small(
				onSkin(
					f,
					svg`<path stroke-linejoin="round" d="M81 ${y + 9} Q100 ${y + 15} 119 ${y + 9} L113 ${b + 2} L100 ${b + 26} L87 ${b + 2}Z"/>`,
					hc,
				),
			);
	}
	return "";
}
function mustache(f: Face, g: Geo, hc: string): string
{
	const y = g.my;
	if (f.facialHair === 1)
	{
		// Two little sausages that meet under the nose.
		return small(
			onSkin(
				f,
				svg`<path d="M82 ${y - 3.5} Q89 ${y - 16} 100 ${y - 9.5} Q111 ${y - 16} 118 ${y - 3.5} Q108 ${y - 6} 100 ${y - 5.5} Q92 ${y - 6} 82 ${y - 3.5}Z"/>`,
				hc,
				2.5,
			),
		);
	}
	if (f.facialHair === 2)
	{
		// A handlebar: wide, with both ends curled up.
		return small(
			sausageOnSkin(
				f,
				svg`M100 ${y - 7} Q88 ${y - 15} 78 ${y - 3} Q72 ${y + 6} 66 ${y - 3} M100 ${y - 7} Q112 ${y - 15} 122 ${y - 3} Q128 ${y + 6} 134 ${y - 3}`,
				hc,
				8.5,
			),
		);
	}
	return "";
}
function cheeks(f: Face, g: Geo, sk: string): string
{
	const {w, ny} = g;
	const cy = ny + 8,
		lx = 100 - w * 0.52,
		rx = 100 + w * 0.52;
	switch (f.cheeks)
	{
		case 1:
			return svg`<g fill="#ff5f86" opacity="${darkSkin(f) ? 0.55 : 0.45}"><ellipse cx="${lx}" cy="${cy}" rx="12.5" ry="8.5"/><ellipse cx="${rx}" cy="${cy}" rx="12.5" ry="8.5"/></g>`;
		case 2:
		{
			let s = "";
			for (const x of [lx, rx])
			{
				for (const [a, c] of [
					[-8, -3],
					[-2, -5],
					[5, -3],
					[-5, 2],
					[1, 1],
					[8, 3],
					[-1, 6],
				] as const)
					s += svg`<circle cx="${x + a}" cy="${cy + c}" r="2.3"/>`;
			}
			return `<g fill="${darkSkin(f) ? shade(sk, 0.5) : shade(sk, -0.5)}">${s}</g>`;
		}
		case 3:
		{
			// Two stripes of face paint on each cheek.
			const stripes = (x: number, s: number): string =>
				svg`M${x - s * 10} ${cy - 3} l${s * 19} -5 M${x - s * 10} ${cy + 6} l${s * 19} -5`;
			return small(sausage(stripes(lx, -1) + " " + stripes(rx, 1), "#3a78f2", 5.5));
		}
		case 4:
			return small(
				svg`<g transform="rotate(-25 ${lx} ${cy})"><rect x="${lx - 14}" y="${cy - 6}" width="28" height="12" rx="5" fill="#f8dcb4"/><rect x="${lx - 5}" y="${cy - 4.5}" width="10" height="9" rx="2" fill="#d99a5c"/></g>`,
			);
		case 5:
			return small(slab(star(rx, cy, 13, 6), "#ffd23f", 2.5));
	}
	return "";
}

// Every pattern spreads across the whole shirt, so neckwear never covers all of it.
function shirtPattern(f: Face): string
{
	const c = CLOTH[f.shirt]!;
	switch (f.shirtStyle)
	{
		case 1:
			return small(sausage("M21 237 H179 M17 247.5 H183", shade(c, -0.45), 4.5));
		case 2:
		{
			let s = "";
			for (const [x, y] of [
				[30, 244],
				[50, 232],
				[68, 246],
				[84, 237],
				[116, 237],
				[132, 246],
				[150, 232],
				[170, 244],
			] as const)
				s += ball(x, y, 4, "#fff");
			return small(s);
		}
		case 3:
			return big(
				`<g fill="${shade(c, -0.35)}"><path d="M12 300 V254 Q16 226 60 219 L46 254 V300Z"/><path d="M188 300 V254 Q184 226 140 219 L154 254 V300Z"/></g>`,
			);
		case 4:
			return small(
				`<g fill="#3b3b45"><path d="M65 222 L56 300 L68 300 L76 226Z"/><path d="M135 222 L144 300 L132 300 L124 226Z"/></g>`,
			);
		case 5:
			return small(
				sausage(
					"M16 247 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10",
					"#fff",
					5,
				),
			);
	}
	return "";
}
function neckwear(f: Face): string
{
	switch (f.neckwear)
	{
		case 1:
			return (
				small(slab("M99 225 L84 217 L84 233Z M101 225 L116 217 L116 233Z", "#2c3e50")) +
				small(ball(100, 225, 5, "#3d546b"))
			);
		case 2:
		{
			const pearls: Ball[] = [];
			for (let i = 0; i < 9; i++)
			{
				const a = Math.PI * (0.15 + (0.7 * i) / 8);
				pearls.push([100 - Math.cos(a) * 24, 214 + Math.sin(a) * 16, 4]);
			}
			return lumps(pearls, "#fffaf0", small);
		}
		case 3:
			return (
				small(
					slab("M82 228 L74 252 L93 252 L95 231Z", "#f39c12", 2) +
						sausage("M79 253 v-7 M84 253 v-7 M89 253 v-7", "#c0392b", 2),
				) +
				small(
					slab("M78 207 Q100 217 122 207 L125 223 Q100 236 75 223Z", "#f39c12", 2) +
						sausage("M88 211 l-2 16 M100 213 v18 M112 211 l2 16", "#c0392b", 3.2),
				)
			);
		case 4:
			return (
				small(slab("M96 232 L104 232 L120 300 L80 300Z", "#7d3c98", 1.5)) +
				small(slab("M93.5 221 L106.5 221 L104 232 L96 232Z", "#6a2f86", 1.5)) +
				small(slab("M99 223 L84 214 L80 228 L93 232Z M101 223 L116 214 L120 228 L107 232Z", "#fff", 2))
			);
		case 5:
		{
			const beads: Ball[] = [];
			for (let i = 0; i <= 12; i++)
			{
				// Points along the same curve the notebook's chain follows, from one side of the neck to the other.
				const u = i / 12,
					v = u < 0.5 ? u * 2 : (1 - u) * 2,
					side = u < 0.5 ? -1 : 1;
				const x = (1 - v) * (1 - v) * 17 + 2 * v * (1 - v) * 10,
					y = (1 - v) * (1 - v) * 213 + 2 * v * (1 - v) * 232 + v * v * 238;
				beads.push([100 + side * x, y, 2.4]);
			}
			return (
				small(beads.map(([x, y, r]) => ball(x, y, r, GOLD)).join("")) +
				small(
					slab("M100 236 l7 8 l-7 9 l-7 -9Z", GOLD, 3) +
						slab("M100 240 l3.6 4 l-3.6 4.6 l-3.6 -4.6Z", "#e5484d", 1),
				)
			);
		}
		case 6:
			return small(
				slab("M75 210 Q100 222 125 210 L100 250Z", "#2a5fd0", 2) +
					ball(90, 221, 2.6, "#fff") +
					ball(110, 221, 2.6, "#fff") +
					ball(100, 228, 2.6, "#fff") +
					ball(100, 240, 2.6, "#fff"),
			);
	}
	return "";
}

function glasses(f: Face, g: Geo): string
{
	const {ey: y, ex, L, R} = g;
	const lx = 100 - ex,
		rx = 100 + ex;
	// Dark frames vanish on the darkest skins, so the plain frames are rolled from pale clay there.
	const frame = darkSkin(f) ? "#efe8d8" : "#34343f";
	const arms = (d: number): string =>
		svg`M${lx + d} ${y - 2} Q100 ${y - 8} ${rx - d} ${y - 2} M${lx - d} ${y - 2} L${L - 1} ${y - 6} M${rx + d} ${y - 2} L${R + 1} ${y - 6}`;
	switch (f.glasses)
	{
		case 1:
			return small(sausage(oval(lx, y, 18, 18) + oval(rx, y, 18, 18) + arms(18), frame, 4));
		case 2:
		{
			const lens = (x: number): string => svg`<rect x="${x - 19}" y="${y - 17}" width="38" height="34" rx="6"/>`;
			return small(
				`<g fill="none" stroke="${frame}" stroke-width="4">${lens(lx)}${lens(rx)}</g>` +
					sausage(arms(19), frame, 4),
			);
		}
		case 3:
		{
			// Aviators: thin gold teardrop frames with a top bar, and clear lenses like every other pair.
			const lens = (x: number, s: number): string =>
				svg`M${x - s * 17} ${y - 18} L${x + s * 19} ${y - 19} Q${x + s * 26} ${y + 8} ${x + s * 5} ${y + 22} Q${x - s * 18} ${y + 23} ${x - s * 17} ${y - 18}Z`;
			return small(
				sausage(
					svg`${lens(lx, -1)} ${lens(rx, 1)} M${lx + 17} ${y - 17} L${rx - 17} ${y - 17} M${lx - 18} ${y - 4} L${L - 1} ${y - 7} M${rx + 18} ${y - 4} L${R + 1} ${y - 7}`,
					GOLD,
					3.4,
				),
			);
		}
		case 4:
		{
			// A monocle on a chain of little beads.
			let chain = "";
			for (let i = 1; i <= 8; i++)
			{
				const u = i / 8;
				chain += ball(
					rx + (1 - u) * (1 - u) * 14 + 2 * u * (1 - u) * 23 + u * u * 8,
					y + (1 - u) * (1 - u) * 14 + 2 * u * (1 - u) * 40 + u * u * 62,
					2,
					"#c9a227",
				);
			}
			return small(sausage(oval(rx, y, 18, 18), "#c9a227", 4.2) + chain);
		}
		case 5:
		{
			// Cat-eye frames: the outer corners sweep up, and the lens stays wider than the largest eye.
			const lens = (x: number, s: number): string =>
				svg`M${x - s * 18} ${y - 12} Q${x} ${y - 21} ${x + s * 27} ${y - 24} Q${x + s * 23} ${y + 14} ${x + s * 3} ${y + 19} Q${x - s * 18} ${y + 18} ${x - s * 18} ${y - 12}Z`;
			return small(
				sausage(
					svg`${lens(lx, -1)} ${lens(rx, 1)} M${lx + 18} ${y - 4} Q100 ${y - 9} ${rx - 18} ${y - 4}`,
					"#ff4fa0",
					4.6,
				),
			);
		}
	}
	return "";
}

// How far a hat rides up on the taller hair styles.
const LIFT: Record<number, number> =
{
	1: 10,
	8: 8,
	2: 4,
	3: 4,
	12: 8,
	13: 4,
};
function hat(f: Face, g: Geo): string
{
	if (!f.hat) return "";
	const {w, t, ey, L, R} = g;
	const afro = f.hairStyle === 4;
	const lift = LIFT[f.hairStyle] ?? 0;
	const hy = afro ? t + 34 - (w + 20) + 30 : t + 16 - lift;
	const hw = w + (afro ? 22 : 5);
	const c = HATC[f.hatColor]!;
	const dome = (h: number): string =>
		svg`<path fill="${c}" d="M${100 - hw} ${hy} Q${100 - hw} ${hy - h} 100 ${hy - h - 2} Q${100 + hw} ${hy - h} ${100 + hw} ${hy}Z"/>`;
	const band = svg`M${L - 2} ${ey - 4} C${L - 6} ${t - 24} ${R + 6} ${t - 24} ${R + 2} ${ey - 4}`;
	switch (f.hat)
	{
		case 1:
			return (
				big(dome(48)) +
				big(
					svg`<path fill="#fffdf6" d="M${100 - hw * 0.5} ${hy} Q${100 - hw * 0.5} ${hy - 44} 100 ${hy - 50} Q${100 + hw * 0.5} ${hy - 44} ${100 + hw * 0.5} ${hy}Z"/>`,
				) +
				small(ball(100, hy - 50, 5, shade(c, -0.2))) +
				big(
					svg`<path fill="${shade(c, -0.2)}" d="M${100 - hw + 2} ${hy - 2} Q100 ${hy - 10} ${100 + hw - 2} ${hy - 2} Q${100 + hw + 6} ${hy + 13} 100 ${hy + 15} Q${100 - hw - 6} ${hy + 13} ${100 - hw + 2} ${hy - 2}Z"/>`,
				)
			);
		case 2:
			return (
				big(dome(52)) +
				big(
					svg`<rect fill="${shade(c, -0.18)}" x="${100 - hw - 3}" y="${hy - 13}" width="${2 * hw + 6}" height="17" rx="8"/>`,
				) +
				small(ball(100, hy - 59, 12, POMPOM))
			);
		case 3:
			return (
				big(
					svg`<rect fill="#30303a" x="${100 - hw * 0.72}" y="${hy - 61}" width="${hw * 1.44}" height="63" rx="6"/>`,
				) +
				small(
					svg`<rect fill="${c}" x="${100 - hw * 0.72 - 1}" y="${hy - 21}" width="${hw * 1.44 + 2}" height="13" rx="3"/>`,
				) +
				big(svg`<ellipse fill="#30303a" cx="100" cy="${hy}" rx="${hw + 14}" ry="8.5"/>`)
			);
		case 4:
			return (
				big(
					slab(
						svg`M${100 - hw * 0.8} ${hy + 2} L${100 - hw * 0.86} ${hy - 35} L${100 - hw * 0.45} ${hy - 16} L100 ${hy - 43} L${100 + hw * 0.45} ${hy - 16} L${100 + hw * 0.86} ${hy - 35} L${100 + hw * 0.8} ${hy + 2}Z`,
						"#f5c542",
					),
				) +
				small(
					ball(100, hy - 10, 5.5, "#e74c3c") +
						ball(100 - hw * 0.45, hy - 6, 4.5, "#3498db") +
						ball(100 + hw * 0.45, hy - 6, 4.5, "#3498db"),
				)
			);
		case 5:
		{
			const bx = 100 - w * 0.5,
				by = t + 4 - (afro ? 20 : lift);
			return (
				small(sausage(band, c, 7)) +
				small(
					slab(
						svg`M${bx - 2} ${by} L${bx - 20} ${by - 13} L${bx - 20} ${by + 13}Z M${bx + 2} ${by} L${bx + 20} ${by - 13} L${bx + 20} ${by + 13}Z`,
						c,
					),
				) +
				small(ball(bx, by, 6.5, shade(c, -0.2)))
			);
		}
		case 6:
			return (
				big(slab(svg`M75 ${hy} L106 ${hy - 65} L129 ${hy + 1}Z`, c)) +
				small(
					ball(96, hy - 14, 3.8, "#fff") +
						ball(110, hy - 30, 3.8, "#fff") +
						ball(104, hy - 48, 3.2, "#fff") +
						ball(116, hy - 10, 3.8, "#fff") +
						ball(86, hy - 4, 3.2, "#fff"),
				) +
				small(ball(106, hy - 68, 8, POMPOM))
			);
		case 7:
			return (
				big(dome(50)) +
				small(
					svg`<path fill="#f1c40f" d="M92 ${hy} Q93 ${hy - 40} 100 ${hy - 52} Q107 ${hy - 40} 108 ${hy}Z"/>`,
				) +
				small(
					sausage(svg`M100 ${hy - 52} L100 ${hy - 64}`, "#5c5c68", 3.4) +
						svg`<ellipse fill="#f1c40f" cx="88" cy="${hy - 66}" rx="12.5" ry="5"/><ellipse fill="#f1c40f" cx="112" cy="${hy - 66}" rx="12.5" ry="5"/>` +
						ball(100, hy - 66, 4, c),
				)
			);
		case 8:
			return (
				big(svg`<ellipse fill="#9a7650" cx="100" cy="${hy}" rx="${hw + 20}" ry="8.5"/>`) +
				big(
					svg`<path fill="#a9855c" d="M${100 - hw * 0.78} ${hy} Q${100 - hw * 0.86} ${hy - 42} ${100 - hw * 0.38} ${hy - 48} Q100 ${hy - 36} ${100 + hw * 0.38} ${hy - 48} Q${100 + hw * 0.86} ${hy - 42} ${100 + hw * 0.78} ${hy}Z"/>`,
				) +
				small(
					svg`<path fill="${c}" d="M${100 - hw * 0.8} ${hy - 15} L${100 + hw * 0.8} ${hy - 15} L${100 + hw * 0.78} ${hy - 3} L${100 - hw * 0.78} ${hy - 3}Z"/>`,
				)
			);
		case 9:
			return (
				small(sausage(svg`M105 ${hy - 44} l4 -11`, shade(c, -0.25), 4.5)) +
				big(
					svg`<path fill="${c}" d="M${100 - hw - 10} ${hy - 8} Q${100 - hw - 6} ${hy - 48} 104 ${hy - 45} Q${100 + hw + 24} ${hy - 42} ${100 + hw + 13} ${hy - 6} Q100 ${hy + 4} ${100 - hw - 10} ${hy - 8}Z"/>`,
				) +
				big(
					svg`<path fill="${shade(c, -0.22)}" d="M${100 - hw + 2} ${hy - 6} Q100 ${hy + 6} ${100 + hw - 2} ${hy - 4} L${100 + hw - 2} ${hy + 3} Q100 ${hy + 13} ${100 - hw + 2} ${hy + 1}Z"/>`,
				)
			);
		case 10:
		case 11:
		{
			const by = t + 6 - (afro ? 20 : lift);
			const cat = f.hat === 10,
				col = cat ? "#26262e" : "#d92b2b";
			let o = "";
			for (const s of [-1, 1])
			{
				const x = 100 + s * w * 0.55;
				o += cat
					? big(
							slab(svg`M${x - 20} ${by + 5} L${x + s * 6} ${by - 42} L${x + 20} ${by + 5}Z`, col) +
								svg`<path fill="#ffb3c7" d="M${x - 10} ${by + 1} L${x + s * 5} ${by - 27} L${x + 11} ${by + 1}Z"/>`,
						)
					: big(
							slab(
								svg`M${x - 10} ${by + 5} Q${x - s * 6} ${by - 22} ${x + s * 20} ${by - 37} Q${x + s * 16} ${by - 8} ${x + 10} ${by + 5}Z`,
								col,
								2,
							),
						);
			}
			return o + small(sausage(band, col, 7));
		}
	}
	return "";
}

function paint(f: Face): string
{
	const g = geo(f),
		sk = SKIN[f.skin]!,
		hc = HAIRC[f.hairColor]!,
		// Dye colors the hair on the head; eyebrows and facial hair keep the natural color.
		dye = f.hairDye ? DYEC[f.hairDye]! : hc,
		cloth = CLOTH[f.shirt]!;
	return (
		hairBack(f, g, dye) +
		// The neck runs on under the shirt, so the two always join.
		big(
			svg`<rect x="86" y="${g.b - 20}" width="28" height="${262 - g.b}" rx="6" fill="${shade(sk, darkSkin(f) ? -0.2 : -0.15)}"/>`,
		) +
		big(
			`<path d="M12 300 V254 Q16 226 60 219 Q80 230 100 230 Q120 230 140 219 Q184 226 188 254 V300Z" fill="${cloth}"/>`,
		) +
		shirtPattern(f) +
		neckwear(f) +
		ears(f, g, sk) +
		big(head(f, g, sk)) +
		cheeks(f, g, sk) +
		beard(f, g, hc) +
		hairFront(f, g, dye) +
		eyes(f, g, sk) +
		brows(f, g, hc) +
		nose(f, g, sk) +
		mouth(f, g) +
		mustache(f, g, hc) +
		glasses(f, g) +
		hat(f, g)
	);
}

// One filter per size of piece: the blurred shape is the height of the clay, lit from the top left, multiplied onto
// the color, with a highlight and a soft shadow underneath.
const lighting = (id: string, blur: number, height: number, shadow: string): string =>
	`<filter id="clay-${id}" filterUnits="userSpaceOnUse" x="-40" y="-80" width="280" height="410" color-interpolation-filters="sRGB">` +
	`<feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>` +
	`<feDiffuseLighting in="b" surfaceScale="${height}" diffuseConstant="1.15" lighting-color="#fff" result="d"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>` +
	`<feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="lit"/>` +
	`<feSpecularLighting in="b" surfaceScale="${height}" specularConstant=".5" specularExponent="21" lighting-color="#fff" result="s"><feDistantLight azimuth="235" elevation="55"/></feSpecularLighting>` +
	`<feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>` +
	`<feMerge result="m"><feMergeNode in="lit"/><feMergeNode in="s2"/></feMerge>` +
	`<feDropShadow in="m" ${shadow} flood-color="#2a1e4a" flood-opacity=".3"/>` +
	`</filter>`;

export const clay: ArtStyle =
{
	id: "clay",
	name: "Modelling Clay",
	blurb: "Soft, rounded clay lit from the top left.",
	defs:
		lighting("big", 4, 6, `dx="1" dy="3" stdDeviation="2.2"`) +
		lighting("small", 1.6, 3.5, `dx=".5" dy="1.5" stdDeviation="1"`),
	paint,
};
