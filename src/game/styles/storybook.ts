import {CLOTH, DYEC, EYEC, type Face, HAIRC, HATC, KEYS, SKIN} from "../faces.ts";
import {geo, type Geo, shade, star} from "../geometry.ts";
import type {ArtStyle} from "./style.ts";

// A warm brown ink. It disappears on the two darkest skins, so lines drawn on the skin there use a warm tone lighter
// than the skin. The eyes keep their ink outline on every skin: the whites already stand out.
const LINE = "#3b2317";
const FACE_LINE = [LINE, LINE, LINE, "#ecc39a", "#cf9767"];
// Three line weights: the silhouette, the features inside it, and the fine marks such as strands and creases.
const OUT = 3.8;
const MID = 2.8;
const FINE = 1.6;
// Shapes drawn as one silhouette are stroked this wide and filled again, which leaves half of it outside.
const UNION = 6.4;
const CREAM = "#fffaf0";
const RED = "#ff4d6d";
const GOLD = "#e6b422";
const darkSkin = (f: Face): boolean => f.skin >= 3;

// Builds markup with every number rounded to one decimal.
function p(parts: TemplateStringsArray, ...args: (number | string)[]): string
{
	return parts.reduce((o, part, i) =>
	{
		const a = args[i - 1]!;
		return o + (typeof a === "number" ? String(Math.round(a * 10) / 10) : a) + part;
	});
}
const channels = (hex: string): number[] =>
{
	const n = parseInt(hex.slice(1), 16);
	return [n >> 16, (n >> 8) & 255, n & 255];
};
function mix(a: string, b: string, t: number): string
{
	const y = channels(b);
	return (
		"#" +
		channels(a)
			.map((v, i) =>
				Math.round(v * (1 - t) + y[i]! * t)
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")
	);
}
const light = (c: string, t: number): string => mix(c, "#fff8e8", t);
const line = (d: string, color: string, width: number): string =>
	`<path fill="none" stroke="${color}" stroke-width="${width}" d="${d}"/>`;
const path = (d: string): string => `<path d="${d}"/>`;
const flat = (d: string, color: string): string => `<path fill="${color}" stroke="none" d="${d}"/>`;
const union = (body: string, fill: string): string =>
	`<g fill="${fill}" stroke-width="${UNION}">${body}</g><g fill="${fill}" stroke="none">${body}</g>`;

// The two-tone palette of one skin: the shadow, the highlight and the rosy tint of noses and lips.
interface Skin
{
	base: string;
	shadow: string;
	lite: string;
	rosy: string;
	line: string;
}
function skinOf(f: Face): Skin
{
	const base = SKIN[f.skin]!;
	const dark = darkSkin(f);
	return {
		base,
		shadow: dark ? mix(base, "#140803", 0.3) : mix(base, "#b25a35", 0.2),
		lite: dark ? mix(base, "#f6b98c", 0.3) : mix(base, "#ffffff", 0.55),
		rosy: mix(base, "#ee5568", dark ? 0.34 : 0.24),
		line: FACE_LINE[f.skin]!,
	};
}
// The tones of one hair color: the shadow side, the highlight band and the strand lines, which are light on dark hair.
interface Tones
{
	base: string;
	dark: string;
	lite: string;
	strand: string;
}
function tonesOf(c: string): Tones
{
	const [r, g, b] = channels(c) as [number, number, number];
	const deep = r * 0.3 + g * 0.59 + b * 0.11 < 70;
	return {
		base: c,
		dark: mix(c, "#1b0e08", deep ? 0.4 : 0.16),
		lite: light(c, deep ? 0.24 : 0.45),
		strand: deep ? light(c, 0.34) : mix(c, "#2a160c", 0.42),
	};
}
const strands = (d: string, hr: Tones): string => line(d, hr.strand, FINE);
const gloss = (d: string, hr: Tones, width = 4): string => line(d, hr.lite, width);

const STUB = ((): [number, number][] =>
{
	let s = 11;
	const r = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
	const a: [number, number][] = [];
	while (a.length < 52)
	{
		const u = r() * 2 - 1,
			v = r();
		if (Math.abs(u) < 1 - v * 0.55 && !(Math.abs(u) < 0.34 && v < 0.32)) a.push([u, v]);
	}
	return a;
})();

function headShape(shape: number, g: Geo): string
{
	const {w, t, b, cy, ry} = g;
	if (shape === 2) return p`<rect x="${100 - w}" y="${t}" width="${2 * w}" height="${b - t}" rx="28"/>`;
	if (shape === 4)
		return p`<path d="M${100 - w} ${t + 50} Q${100 - w} ${t} 100 ${t} Q${100 + w} ${t} ${100 + w} ${t + 50} Q${100 + w - 4} ${b - 40} 100 ${b} Q${100 - w + 4} ${b - 40} ${100 - w} ${t + 50}Z"/>`;
	return p`<ellipse cx="100" cy="${cy}" rx="${w}" ry="${ry}"/>`;
}
// The head of each face shape as a clip path, and the strip where the chin crosses the neck. The page keeps them in its
// defs, and each face also carries the ones it uses, so a face drawn on its own is clipped the same way.
const HEAD_CLIPS = [0, 1, 2, 3, 4].map((shape) =>
{
	const g = geo(
		{
			...(Object.fromEntries(KEYS.map((k) => [k, 0])) as Face),
			faceShape: shape,
		},
	);
	return `<clipPath id="storybook-head-${shape}">${headShape(shape, g)}</clipPath>`;
});
const NECK_CLIP = `<clipPath id="storybook-neck"><rect x="87.6" y="150" width="24.8" height="80"/></clipPath>`;

function hairBack(f: Face, g: Geo, hr: Tones): string
{
	const {w, t, ey, L, R} = g;
	switch (f.hairStyle)
	{
		case 2:
		{
			const y1 = ey + 41;
			return (
				p`<path fill="${hr.dark}" stroke-width="${OUT}" d="M${L - 12} ${t + 26} Q${L - 12} ${t - 8} 100 ${t - 8} Q${R + 12} ${t - 8} ${R + 12} ${t + 26} L${R + 13} ${y1 - 16} Q${R + 13} ${y1 + 1} ${R - 4} ${y1} L${L + 4} ${y1} Q${L - 13} ${y1 + 1} ${L - 13} ${y1 - 16}Z"/>` +
				strands(
					p`M${L - 8} ${ey + 2} Q${L - 10} ${ey + 22} ${L - 4} ${y1 - 5} M${R + 8} ${ey + 2} Q${R + 10} ${ey + 22} ${R + 4} ${y1 - 5}`,
					hr,
				)
			);
		}
		case 3:
			return (
				p`<path fill="${hr.dark}" stroke-width="${OUT}" d="M${L - 14} ${t + 34} Q${L - 16} ${t - 12} 100 ${t - 12} Q${R + 16} ${t - 12} ${R + 14} ${t + 34} L${R + 22} 231 Q${R + 13} 243 ${R + 3} 235 Q100 246 ${L - 3} 235 Q${L - 13} 243 ${L - 22} 231Z"/>` +
				strands(
					p`M${L - 9} ${ey + 4} Q${L - 17} ${ey + 60} ${L - 14} 226 M${L - 2} ${ey + 44} Q${L - 9} ${ey + 80} ${L - 6} 228 M${R + 9} ${ey + 4} Q${R + 17} ${ey + 60} ${R + 14} 226 M${R + 2} ${ey + 44} Q${R + 9} ${ey + 80} ${R + 6} 228`,
					hr,
				) +
				gloss(p`M${L - 12} ${ey + 16} Q${L - 16} ${ey + 40} ${L - 15} ${ey + 62}`, hr, 3)
			);
		case 4:
		{
			const cy = t + 34,
				r = w + 19;
			let body = p`<circle cx="100" cy="${cy}" r="${r}"/>`;
			for (let i = 0; i < 14; i++)
			{
				const a = Math.PI * (0.8 + (i * 1.4) / 13);
				body += p`<circle cx="${100 + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" r="14"/>`;
			}
			// Small curls all over, lighter where the light falls from the top left.
			let curls = "",
				lit = "";
			for (const [ring, n, turn] of [
				[0.86, 15, 0],
				[0.58, 9, 0.07],
			] as const)
			{
				for (let i = 0; i < n; i++)
				{
					const a = Math.PI * (0.82 + turn + (i * 1.36) / (n - 1));
					const d = p`M${100 + Math.cos(a) * r * ring - 4} ${cy + Math.sin(a) * r * ring + 2} q1 -7 7 -4 `;
					if (a > Math.PI * 1.05 && a < Math.PI * 1.5) lit += d;
					else curls += d;
				}
			}
			return union(body, hr.base) + strands(curls, hr) + gloss(lit, hr, 2.4);
		}
		case 5:
			return (
				p`<path fill="${hr.base}" stroke-width="${OUT}" d="M${R} ${t + 30} C${R + 24} ${t + 14} ${R + 40} ${t + 42} ${R + 31} ${t + 72} C${R + 26} ${t + 90} ${R + 14} ${t + 101} ${R} ${t + 105} C${R + 9} ${t + 86} ${R + 6} ${t + 62} ${R - 2} ${t + 42}Z"/>` +
				strands(
					p`M${R + 9} ${t + 34} Q${R + 27} ${t + 52} ${R + 14} ${t + 92} M${R + 6} ${t + 42} Q${R + 17} ${t + 62} ${R + 8} ${t + 96}`,
					hr,
				) +
				gloss(p`M${R + 20} ${t + 31} Q${R + 30} ${t + 44} ${R + 28} ${t + 60}`, hr, 3) +
				p`<circle fill="${RED}" stroke-width="${MID}" cx="${R + 4}" cy="${t + 32}" r="6.5"/>` +
				line(p`M${R + 1} ${t + 30} q2 -3 5 -1.5`, light(RED, 0.6), FINE)
			);
		case 7:
		{
			let o = "";
			for (const s of [-1, 1])
			{
				const x = 100 + s * (w - 4),
					y = t + 2;
				o +=
					p`<circle fill="${hr.base}" stroke-width="${OUT}" cx="${x}" cy="${y}" r="22.5"/>` +
					strands(
						p`M${x - s * 16} ${y + 2} Q${x - s * 14} ${y - 15} ${x} ${y - 15} Q${x + s * 12} ${y - 13} ${x + s * 13} ${y - 2} M${x - s * 7} ${y - 2} Q${x - s * 4} ${y - 8} ${x + s * 3} ${y - 7}`,
						hr,
					) +
					gloss(p`M${x - 16} ${y - 9} Q${x - 12} ${y - 17} ${x - 3} ${y - 19}`, hr, 3);
			}
			return o;
		}
		case 11:
		{
			// Two braids hang beside the neck, each a chain of knots with a tie and a tuft at the end.
			let o = "";
			for (const x of [L - 9, R + 9])
			{
				let body = "",
					creases = "";
				for (let i = 0; i < 5; i++)
				{
					const kx = x + (i % 2 ? 2 : -2),
						ky = ey + 28 + i * 15;
					body += p`<ellipse cx="${kx}" cy="${ky}" rx="9" ry="9.5"/>`;
					creases += p`M${kx - 5} ${ky - 3} L${kx} ${ky + 3} L${kx + 5} ${ky - 3} `;
				}
				o +=
					p`<path fill="${hr.base}" stroke-width="${MID}" d="M${x - 5} ${ey + 104} Q${x - 1} ${ey + 122} ${x + 1} ${ey + 122} Q${x + 3} ${ey + 116} ${x + 5} ${ey + 104}Z"/>` +
					union(body, hr.base) +
					strands(creases, hr) +
					p`<circle fill="${RED}" stroke-width="${MID}" cx="${x}" cy="${ey + 102}" r="5.5"/>`;
			}
			return o;
		}
	}
	return "";
}

// The hair over the forehead: the shapes of its silhouette, and the strands and highlight drawn on top of them.
interface Hair
{
	body: string;
	detail: string;
}
function hairFront(f: Face, g: Geo, hr: Tones, sk: Skin): Hair
{
	const {w, t, ey, L, R, cy, ry} = g;
	const fb = ey - 28;
	const P = (th: number, e = 0): [number, number] => [
		100 + (w + 3 + e) * Math.cos(th),
		cy + (ry + 3 + e) * Math.sin(th),
	];
	const cap = p`M${L - 3} ${ey - 8} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 3} ${ey - 8}`;
	// A band of light across the top left of the crown, and the shine of a bare scalp.
	const band = (dy = 0): string =>
		gloss(
			p`M${100 - w * 0.72} ${t + 24 + dy} Q${100 - w * 0.56} ${t + 5 + dy} ${100 - w * 0.16} ${t + 2 + dy}`,
			hr,
		);
	const shine = (x: number): string =>
		line(p`M${x} ${t + 17} q11 -9 24 -6`, sk.lite, 4.5) + line(p`M${x + 31} ${t + 12.5} h0.1`, sk.lite, 4.5);
	const parted = p`${cap} Q${R - 4} ${fb} 106 ${fb - 6} L100 ${t + 6} L94 ${fb - 6} Q${L + 4} ${fb} ${L - 3} ${ey - 8}Z`;
	const partedDetail =
		strands(
			p`M100 ${t + 2} Q${100 - w * 0.5} ${t + 4} ${L + 7} ${fb - 5} M100 ${t + 2} Q${100 + w * 0.5} ${t + 4} ${R - 7} ${fb - 5}`,
			hr,
		) +
		line(p`M100 ${t + 6} L100 ${t - 7}`, LINE, FINE) +
		band(4);
	switch (f.hairStyle)
	{
		case 0:
			return {
				body: "",
				detail: shine(100 - w * 0.45),
			};
		case 1:
		{
			const pts: [number, number][] = [[L - 3, ey - 12]];
			let creases = "";
			const N = 12;
			for (let i = 0; i <= N; i++)
			{
				const th = Math.PI * (1.08 + (0.84 * i) / N);
				pts.push(P(th, i % 2 ? 20 : 0));
				if (i % 2) creases += p`M${P(th, 12).join(" ")} L${P(th, -7).join(" ")} `;
			}
			pts.push([R + 3, ey - 12]);
			for (let i = 0; i <= 7; i++) pts.push([R - 4 - ((2 * w - 8) * i) / 7, i % 2 ? fb - 9 : fb]);
			return {
				body: path("M" + pts.map(([x, y]) => p`${x} ${y}`).join(" L") + "Z"),
				detail: strands(creases, hr) + band(8),
			};
		}
		case 2:
		{
			const notch = (x: number): string => p`L${x + 3} ${fb} L${x} ${fb - 6} L${x - 3} ${fb} `;
			return {
				body: path(
					p`M${L - 4} ${ey - 4} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 4} ${ey - 4} L${R - 6} ${ey - 6} L${R - 8} ${fb} ${notch(100 + w * 0.36)}${notch(100 - w * 0.28)}L${L + 8} ${fb} L${L + 6} ${ey - 6}Z`,
				),
				detail:
					strands(
						p`M${100 - w * 0.62} ${fb - 3} v-10 M${100 + w * 0.04} ${fb - 3} v-9 M${100 + w * 0.66} ${fb - 3} v-10 M100 ${t - 6} Q${100 + w * 0.5} ${t - 2} ${R - 4} ${t + 22}`,
						hr,
					) + band(2),
			};
		}
		case 3:
			return {
				body: path(
					p`M${L - 4} ${ey + 6} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 4} ${ey + 6} Q${R - 4} ${fb} ${R - 20} ${fb - 2} Q100 ${fb - 6} 84 ${t + 10} Q${L + 12} ${fb + 4} ${L + 5} ${ey + 6}Z`,
				),
				detail:
					strands(
						p`M86 ${t + 6} Q${100 + w * 0.3} ${t + 2} ${R - 12} ${fb - 7} M88 ${t + 2} Q${100 + w * 0.6} ${t - 6} ${R - 2} ${fb + 2} M82 ${t + 6} Q${L + 10} ${t + 14} ${L + 2} ${ey - 8}`,
						hr,
					) +
					line(p`M84 ${t + 10} L86 ${t - 4}`, LINE, FINE) +
					band(2),
			};
		case 4:
			return {
				body: path(
					p`M${L - 2} ${ey - 10} C${L - 6} ${t - 28} ${R + 6} ${t - 28} ${R + 2} ${ey - 10} Q${R - 6} ${fb} 100 ${fb - 8} Q${L + 6} ${fb} ${L - 2} ${ey - 10}Z`,
				),
				detail:
					strands(
						p`M${100 - w * 0.5} ${t + 16} q1 -7 7 -4 M${100 + w * 0.3} ${t + 14} q1 -7 7 -4 M${100 - w * 0.08} ${t + 22} q1 -7 7 -4`,
						hr,
					) + gloss(p`M${100 - w * 0.2} ${t + 6} q1 -7 7 -4`, hr, 2.4),
			};
		case 5:
			return {
				body: path(
					p`${cap} Q${R - 2} ${fb + 2} ${R - 14} ${fb} Q100 ${fb - 16} ${L + 14} ${fb} Q${L + 2} ${fb + 2} ${L - 3} ${ey - 8}Z`,
				),
				detail:
					strands(
						p`M${L + 12} ${fb - 5} Q${100 - w * 0.2} ${t + 4} ${R - 4} ${t + 24} M${100 - w * 0.2} ${fb - 11} Q${100 + w * 0.4} ${t + 12} ${R - 3} ${t + 31}`,
						hr,
					) + band(2),
			};
		case 6:
			return {
				body: path(
					p`M88 ${t + 26} Q84 ${t + 8} 85.5 ${t - 8} L91 ${t - 24} Q93.5 ${t - 18} 95.5 ${t - 13} Q97 ${t - 28} 100 ${t - 39} Q103 ${t - 28} 104.5 ${t - 13} Q106.5 ${t - 18} 109 ${t - 24} L114.5 ${t - 8} Q116 ${t + 8} 112 ${t + 26} Q100 ${t + 30} 88 ${t + 26}Z`,
				),
				detail:
					strands(
						p`M94.5 ${t + 20} L93 ${t - 9} M100 ${t + 22} L100 ${t - 22} M105.5 ${t + 20} L107 ${t - 9}`,
						hr,
					) + gloss(p`M90.5 ${t + 14} L89 ${t - 3}`, hr, 2.6),
			};
		case 7:
		case 11:
			return {
				body: path(parted),
				detail: partedDetail,
			};
		case 8:
		{
			let body = path(
				p`M${L - 2} ${ey - 10} C${L - 6} ${t - 28} ${R + 6} ${t - 28} ${R + 2} ${ey - 10} Q${R - 6} ${fb} 100 ${fb - 6} Q${L + 6} ${fb} ${L - 2} ${ey - 10}Z`,
			);
			// The curls stop above the ears, so ears and earrings stay in sight.
			let curls = "",
				lit = "";
			for (let i = 0; i < 11; i++)
			{
				const [x, y] = P(Math.PI * (1.15 + (i * 0.7) / 10), 1);
				body += p`<circle cx="${x}" cy="${y}" r="10"/>`;
				const d = p`M${x - 4} ${y + 3} q1 -7 7 -4 `;
				if (i > 0 && i < 5) lit += d;
				else curls += d;
			}
			return {
				body,
				detail:
					strands(
						curls +
							p`M${100 - w * 0.36} ${t + 16} q1 -7 7 -4 M${100 + w * 0.2} ${t + 14} q1 -7 7 -4 M${100 - w * 0.02} ${fb - 13} q1 -7 7 -4`,
						hr,
					) + gloss(lit, hr, 2.4),
			};
		}
		case 9:
		{
			// Balding: a tuft over each ear and a bare, shiny top.
			const side = (x: number, s: number): string =>
				p`M${x - s * 4} ${ey + 2} C${x - s * 12} ${t + 30} ${x + s * 2} ${t + 10} ${x + s * 17} ${t + 15} Q${x + s * 8} ${t + 40} ${x + s * 9} ${ey + 2}Z`;
			const comb = (x: number, s: number): string =>
				p`M${x} ${ey - 4} Q${x - s * 2} ${t + 34} ${x + s * 9} ${t + 20} M${x + s * 5} ${ey - 5} Q${x + s * 5} ${t + 40} ${x + s * 11} ${t + 28} `;
			return {
				body: path(side(L, 1) + " " + side(R, -1)),
				detail: strands(comb(L, 1) + comb(R, -1), hr) + shine(100 - w * 0.3),
			};
		}
		case 10:
			// A side part: the hair piles high on one side and sweeps down across the forehead.
			return {
				body: path(
					p`M${L - 3} ${ey - 8} C${L - 6} ${t - 14} ${L + 18} ${t - 22} ${L + 24} ${t - 8} C${L + 40} ${t - 44} ${R + 16} ${t - 40} ${R + 3} ${ey - 8} Q${R - 2} ${fb + 6} ${R - 14} ${fb + 6} Q100 ${fb - 2} ${L + 24} ${t + 8} Q${L + 10} ${fb - 6} ${L - 3} ${ey - 8}Z`,
				),
				detail:
					strands(
						p`M${L + 28} ${t + 2} Q${100 + w * 0.1} ${t - 14} ${R - 6} ${t + 16} M${L + 30} ${t + 9} Q${100 + w * 0.2} ${t + 2} ${R - 9} ${fb - 2} M${L + 20} ${t + 2} Q${L + 6} ${t + 8} ${L + 2} ${ey - 14}`,
						hr,
					) +
					line(p`M${L + 24} ${t + 8} L${L + 24} ${t - 8}`, LINE, FINE) +
					gloss(p`M${L + 38} ${t - 9} Q${100 + w * 0.06} ${t - 26} ${100 + w * 0.5} ${t - 17}`, hr),
			};
		case 12:
		{
			// A flat-top: straight sides and a level top, brushed upright.
			let bristles = "";
			for (let i = 1; i < 8; i++) bristles += p`M${L - 4 + ((2 * w + 8) * i) / 8} ${t - 21} v${i % 2 ? 9 : 6} `;
			return {
				body: path(
					p`M${L - 3} ${ey - 8} L${L - 6} ${t - 24} L${R + 6} ${t - 24} L${R + 3} ${ey - 8} Q${R - 4} ${fb + 2} 100 ${fb - 4} Q${L + 4} ${fb + 2} ${L - 3} ${ey - 8}Z`,
				),
				detail: strands(bristles, hr) + gloss(p`M${L + 3} ${t - 6} L${L + 2} ${t + 16}`, hr),
			};
		}
		case 13:
			// A bowl cut: a round cap with a straight fringe just above the eyebrows.
			return {
				body: path(
					p`M${L - 5} ${ey - 2} C${L - 12} ${t - 34} ${R + 12} ${t - 34} ${R + 5} ${ey - 2} L${R - 5} ${ey - 2} L${R - 6} ${fb + 5} L${L + 6} ${fb + 5} L${L + 5} ${ey - 2}Z`,
				),
				detail:
					strands(
						p`M100 ${t - 8} L100 ${fb + 1} M100 ${t - 8} Q${100 - w * 0.4} ${t} ${100 - w * 0.5} ${fb + 1} M100 ${t - 8} Q${100 + w * 0.4} ${t} ${100 + w * 0.5} ${fb + 1} M100 ${t - 8} Q${100 - w * 0.9} ${t - 2} ${L + 2} ${fb - 4} M100 ${t - 8} Q${100 + w * 0.9} ${t - 2} ${R - 2} ${fb - 4}`,
						hr,
					) + gloss(p`M${100 - w * 0.62} ${t + 12} q${w * 0.5} -15 ${w * 1.05} -3`, hr, 4.5),
			};
	}
	return {
		body: "",
		detail: "",
	};
}
function ears(f: Face, g: Geo, sk: Skin): string
{
	const {w, ey} = g;
	const y = ey + 10;
	const EB = [
		[5, 14],
		[9, 21],
		[8, 14],
		[14, 9],
	];
	const fold = (d: string): string => line(d, sk.line, 2.2);
	let o = "";
	for (const s of [-1, 1])
	{
		const x = 100 + s * (w - 3);
		switch (f.ears)
		{
			case 0:
				o +=
					p`<ellipse cx="${x + s * 5}" cy="${y}" rx="10" ry="14"/><ellipse cx="${x + s * 9}" cy="${y + 1}" rx="3.4" ry="7.5" fill="${sk.shadow}" stroke="none"/>` +
					fold(p`M${x + s * 10} ${y - 7} q${-s * 6} 7 0 14`);
				break;
			case 1:
				o +=
					p`<ellipse cx="${x + s * 9}" cy="${y}" rx="15" ry="21"/><ellipse cx="${x + s * 14}" cy="${y + 1}" rx="5.5" ry="12" fill="${sk.shadow}" stroke="none"/>` +
					fold(p`M${x + s * 16} ${y - 11} q${-s * 9} 11 0 22`);
				break;
			case 2:
				o +=
					p`<path d="M${x} ${y - 10} Q${x + s * 14} ${y - 18} ${x + s * 24} ${y - 30} Q${x + s * 18} ${y - 4} ${x + s * 8} ${y + 14} Q${x + s * 2} ${y + 16} ${x} ${y + 10}Z"/>` +
					flat(
						p`M${x + s * 5} ${y + 6} Q${x + s * 8} ${y - 10} ${x + s * 20} ${y - 23} Q${x + s * 15} ${y - 6} ${x + s * 8} ${y + 8}Z`,
						sk.shadow,
					) +
					fold(p`M${x + s * 5} ${y + 6} Q${x + s * 8} ${y - 10} ${x + s * 19} ${y - 22}`);
				break;
			case 3:
				o +=
					p`<g transform="rotate(${-s * 25} ${x + s * 14} ${y})"><ellipse cx="${x + s * 14}" cy="${y}" rx="16" ry="11"/><ellipse cx="${x + s * 17}" cy="${y + 0.5}" rx="8" ry="5" fill="${sk.shadow}" stroke="none"/>` +
					fold(p`M${x + s * 9} ${y + 4} Q${x + s * 20} ${y + 7} ${x + s * 24} ${y - 1}`) +
					`</g>`;
				break;
		}
		if (f.earrings)
		{
			const [dx, dy] = EB[f.ears] as [number, number];
			const ex = x + s * dx,
				ey2 = y + dy;
			o += [
				p`<circle cx="${ex}" cy="${ey2 + 7}" r="7.5" fill="none" stroke-width="5.4"/><circle cx="${ex}" cy="${ey2 + 7}" r="7.5" fill="none" stroke="${GOLD}" stroke-width="3"/>` +
					line(p`M${ex - 6.6} ${ey2 + 3.5} A7.5 7.5 0 0 1 ${ex - 1} ${ey2 - 0.4}`, "#fff3b0", 1.2),
				p`<path d="M${ex} ${ey2 - 1} v4" fill="none" stroke-width="2"/><path d="M${ex} ${ey2 + 2} q-10 13 0 17 q10 -4 0 -17Z" fill="#35c4f0" stroke-width="1.8"/>` +
					line(p`M${ex - 2.6} ${ey2 + 10} q-1.5 3.5 0.6 5.4`, "#d6f6ff", 1.6),
				p`<circle cx="${ex}" cy="${ey2 + 6}" r="7.5" fill="#e5484d" stroke-width="1.8"/><circle cx="${ex - 2.6}" cy="${ey2 + 3.2}" r="1.9" fill="#ffc2c0" stroke="none"/>`,
				p`<path d="M${ex} ${ey2 - 1} l-8.5 19 h17Z" fill="#3fbf6f" stroke-width="1.8"/>` +
					flat(p`M${ex} ${ey2 + 3} l-5 12.5 h5Z`, "#8fe0ab"),
			][f.earrings - 1]!;
		}
	}
	return `<g fill="${sk.base}" stroke-width="${OUT}">${o}</g>`;
}
function eye(f: Face, x: number, y: number, s: number, sk: Skin): string
{
	const ic = EYEC[f.eyeColor]!;
	// The white, shaded under the upper lid.
	const ball = (r: number): string =>
		p`<circle cx="${x}" cy="${y}" r="${r}" fill="${CREAM}" stroke="none"/>` +
		flat(p`M${x - r} ${y} A${r} ${r} 0 0 1 ${x + r} ${y} Q${x} ${y - r * 1.3} ${x - r} ${y}Z`, "#e3d5d3");
	// The iris is darker under the lid and lighter below, with a catchlight at the top left.
	const iris = (cx: number, cy: number, r: number, pr: number): string =>
		p`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ic}" stroke="${shade(ic, -0.5)}" stroke-width="1.4"/>` +
		flat(
			p`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} Q${cx} ${cy - r * 0.9} ${cx - r} ${cy}Z`,
			shade(ic, -0.3),
		) +
		flat(
			p`M${cx - r * 0.72} ${cy + r * 0.4} Q${cx} ${cy + r * 1.2} ${cx + r * 0.72} ${cy + r * 0.4} Q${cx} ${cy + r * 0.82} ${cx - r * 0.72} ${cy + r * 0.4}Z`,
			mix(ic, "#ffffff", 0.4),
		) +
		p`<circle cx="${cx}" cy="${cy}" r="${pr}" fill="#1c110b" stroke="none"/><circle cx="${cx - r * 0.38}" cy="${cy - r * 0.36}" r="${Math.max(1.5, r * 0.3)}" fill="#fff" stroke="none"/><circle cx="${cx + r * 0.42}" cy="${cy + r * 0.4}" r="${r * 0.13}" fill="#fff" stroke="none"/>`;
	const ring = (r: number): string => p`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke-width="2"/>`;
	// The upper lid is drawn heavier than the rest of the outline.
	const lid = (r: number, width: number): string =>
		p`<path fill="none" stroke-width="${width}" d="M${x - r * 0.954} ${y - r * 0.3} A${r} ${r} 0 0 1 ${x + r * 0.954} ${y - r * 0.3}"/>`;
	switch (f.eyes)
	{
		case 0:
			return ball(10) + iris(x, y + 1, 6.8, 3) + ring(10) + lid(10, 3.4);
		case 1:
			return ball(14) + iris(x, y + 1, 9.5, 4.2) + ring(14) + lid(14, 3);
		case 2:
			return (
				ball(11) +
				iris(x, y + 1, 7, 3) +
				ring(11) +
				p`<path d="M${x - 11.8} ${y - 2} A12 12 0 0 1 ${x + 11.8} ${y - 2} Q${x} ${y - 0.5} ${x - 11.8} ${y - 2}Z" fill="${mix(sk.base, sk.shadow, 0.55)}" stroke-width="2"/>` +
				line(p`M${x - 7} ${y - 7.5} Q${x} ${y - 10} ${x + 7} ${y - 7.5}`, mix(sk.base, sk.shadow, 1.6), FINE) +
				p`<path fill="none" stroke-width="3.6" d="M${x - 11.8} ${y - 2} Q${x} ${y - 0.5} ${x + 11.8} ${y - 2}"/>`
			);
		case 3:
		{
			const top = p`M${x - 15} ${y} Q${x} ${y - 12} ${x + 15} ${y}`;
			return (
				`<path d="${top} ${p`Q${x} ${y + 12} ${x - 15} ${y}`}Z" fill="${CREAM}" stroke="none"/>` +
				flat(p`${top} Q${x} ${y - 7} ${x - 15} ${y}Z`, "#e3d5d3") +
				iris(x, y, 6.3, 2.8) +
				`<path d="${top} ${p`Q${x} ${y + 12} ${x - 15} ${y}`}Z" fill="none" stroke-width="2"/>` +
				`<path d="${top}" fill="none" stroke-width="3.2"/>`
			);
		}
		case 4:
			return (
				ball(10) +
				iris(x, y + 1, 6.8, 3) +
				ring(10) +
				lid(10, 4.8) +
				line(
					p`M${x + s * 4} ${y - 10} q${s * 0.5} -4 ${s * 4.5} -7 M${x + s * 8} ${y - 7} q${s * 3} -3.5 ${s * 9} -5 M${x + s * 10} ${y - 2.5} q${s * 4} -1.5 ${s * 10} -0.5 M${x - s * 2} ${y - 11} q${-s * 0.5} -3 ${s * 0.5} -6.5`,
					sk.line,
					2.8,
				)
			);
		case 5:
			return ball(11) + iris(x + 4, y + 1, 7, 3) + ring(11) + lid(11, 3.4);
	}
	return "";
}
function eyes(f: Face, g: Geo, sk: Skin): string
{
	return eye(f, 100 - g.ex, g.ey, -1, sk) + eye(f, 100 + g.ex, g.ey, 1, sk);
}
function brows(f: Face, g: Geo, hc: string): string
{
	const {ey, ex} = g;
	// Glasses push the eyebrows up, so no frame ever sits on top of them.
	const y = ey - (f.eyes === 1 ? 22 : 18) - (f.glasses ? 7 : 0);
	// Each brow is a tapered shape, blunt at the inner end.
	const one = (s: number): string =>
	{
		const x = 100 + s * ex,
			xo = x + s * 12,
			xi = x - s * 11;
		switch (f.eyebrows)
		{
			case 0:
				return p`M${xi} ${y - 2} Q${x} ${y - 9.5} ${xo} ${y + 0.5} Q${xo + s} ${y + 3} ${xo - s} ${y + 3.5} Q${x} ${y - 3} ${xi} ${y + 4}Z`;
			case 1:
				return p`M${xi} ${y - 6.5} L${xi + s * 6} ${y - 8} L${xi + s * 11} ${y - 6.5} L${xi + s * 17} ${y - 8} L${xo} ${y - 6} Q${xo + s * 2} ${y - 1} ${xo} ${y + 4} L${xi} ${y + 4.5} Q${xi - s * 2} ${y - 1} ${xi} ${y - 6.5}Z`;
			case 2:
				return p`M${xi} ${y + 0.5} L${xo} ${y - 6.5} L${xo + s * 0.5} ${y - 2.5} L${xi} ${y + 7}Z`;
			case 3:
				return p`M${xi} ${y - 8} L${xo} ${y + 0.5} L${xo + s * 0.5} ${y + 4.5} L${xi} ${y - 1.5}Z`;
			case 5:
				return s < 0
					? p`M${xi} ${y - 8} Q${x} ${y - 21} ${xo} ${y - 5} Q${xo} ${y - 3} ${xo - s} ${y - 2.5} Q${x} ${y - 14} ${xi} ${y - 2}Z`
					: p`M${xi} ${y} L${xo} ${y - 1} L${xo + s * 0.5} ${y + 3} L${xi} ${y + 6}Z`;
		}
		return "";
	};
	const a = 100 - ex,
		b = 100 + ex;
	const d =
		f.eyebrows === 4
			? p`M${a - 13} ${y - 1} Q${a} ${y - 10.5} 100 ${y - 3.5} Q${b} ${y - 10.5} ${b + 13} ${y - 1} Q${b + 14} ${y + 2.5} ${b + 12} ${y + 3} Q${b} ${y - 2.5} 100 ${y + 4} Q${a} ${y - 2.5} ${a - 12} ${y + 3} Q${a - 14} ${y + 2.5} ${a - 13} ${y - 1}Z`
			: one(-1) + " " + one(1);
	return `<path d="${d}" fill="${hc}" stroke-width="1.8"/>`;
}
function nose(f: Face, g: Geo, sk: Skin): string
{
	const y = g.ny;
	// A faint rosy tint sits under the line noses.
	const tint = (cy: number, rx: number): string =>
		p`<ellipse cx="100" cy="${cy}" rx="${rx}" ry="5" fill="${sk.rosy}" stroke="none" opacity=".4"/>`;
	switch (f.nose)
	{
		case 0:
			return tint(y + 1, 7) + p`<path fill="none" d="M95 ${y - 1} Q100 ${y + 7} 105 ${y - 1}"/>`;
		case 1:
			return tint(y + 1, 7) + p`<path fill="none" d="M101 ${y - 16} L94 ${y + 4} L104 ${y + 4}"/>`;
		case 2:
			return (
				tint(y + 3, 7) +
				p`<path fill="none" d="M100 ${y - 20} Q103 ${y - 2} 97 ${y + 5} Q101 ${y + 9} 106 ${y + 4}"/>`
			);
		case 3:
			return (
				p`<circle cx="100" cy="${y}" r="10" fill="${sk.rosy}"/>` +
				line(p`M94.5 ${y - 3} q1.5 -3.5 5 -4`, sk.lite, 2.4)
			);
		case 4:
			return (
				p`<path fill="${mix(sk.base, sk.rosy, 0.6)}" d="M97 ${y - 18} Q115 ${y - 2} 106 ${y + 6} Q100 ${y + 8} 95 ${y + 4}"/>` +
				line(p`M103 ${y - 6} q3.5 4 2 8`, sk.lite, 2.4)
			);
		case 5:
			return (
				tint(y, 11) +
				p`<path fill="none" d="M87 ${y + 2} Q90 ${y - 7} 95 ${y + 1} Q100 ${y + 6} 105 ${y + 1} Q110 ${y - 7} 113 ${y + 2}"/>`
			);
		case 6:
			return (
				p`<ellipse cx="100" cy="${y}" rx="11" ry="8" fill="#f7a1b0"/><ellipse cx="96" cy="${y}" rx="2" ry="3" fill="#5a2a30" stroke="none"/><ellipse cx="104" cy="${y}" rx="2" ry="3" fill="#5a2a30" stroke="none"/>` +
				line(p`M92.5 ${y - 3.5} q3 -2.5 7 -2.5`, "#fdd5dc", 1.8)
			);
	}
	return "";
}
function mouth(f: Face, g: Geo, sk: Skin): string
{
	const y = g.my;
	// The shadow under the lower lip.
	const under = (dy: number): string => line(p`M95.5 ${y + dy} q4.5 1.8 9 0`, mix(sk.base, sk.shadow, 1.4), FINE);
	switch (f.mouth)
	{
		case 0:
			return p`<path fill="none" d="M86 ${y} Q100 ${y + 13} 114 ${y}"/>` + under(12.5);
		case 1:
			return (
				p`<path fill="#fffdf6" stroke="${LINE}" d="M84 ${y - 2} L116 ${y - 2} Q114 ${y + 18} 100 ${y + 18} Q86 ${y + 18} 84 ${y - 2}Z"/>` +
				line(
					p`M85.5 ${y + 5.5} L114.5 ${y + 5.5} M93 ${y - 1} L93 ${y + 15.5} M100 ${y - 1} L100 ${y + 17} M107 ${y - 1} L107 ${y + 15.5}`,
					"#8d7466",
					FINE,
				)
			);
		case 2:
			return p`<path fill="none" d="M87 ${y + 9} Q100 ${y - 4} 113 ${y + 9}"/>` + under(11);
		case 3:
			return p`<ellipse cx="100" cy="${y + 5}" rx="8" ry="10" fill="#7a2228"/><ellipse cx="100" cy="${y + 10.5}" rx="4.4" ry="3" fill="#e0687a" stroke="none"/>`;
		case 4:
			return p`<path fill="none" d="M88 ${y + 4} L112 ${y + 4}"/>` + under(10);
		case 5:
			return (
				p`<path fill="#ff7a8a" d="M95 ${y + 5} Q95 ${y + 20} 101 ${y + 20} Q107 ${y + 20} 107 ${y + 5}Z"/>` +
				line(p`M101 ${y + 8} v6`, "#c4455a", FINE) +
				p`<path fill="none" d="M86 ${y} Q100 ${y + 12} 114 ${y}"/>`
			);
		case 6:
			return p`<path fill="none" d="M87 ${y + 5} Q104 ${y + 7} 114 ${y - 4}"/>` + under(11.5);
		case 7:
			return (
				p`<path fill="none" d="M86 ${y} Q100 ${y + 9} 114 ${y}"/>` +
				p`<path fill="#fffdf6" stroke="${LINE}" stroke-width="2" d="M95 ${y + 4} h10 v9 h-10Z M100 ${y + 4} v9"/>`
			);
		case 8:
			// Puckered lips, with a crease at each side.
			return (
				p`<path fill="#e0455a" d="M90 ${y + 4} Q95 ${y - 5} 100 ${y + 1} Q105 ${y - 5} 110 ${y + 4} Q107 ${y + 16} 100 ${y + 16} Q93 ${y + 16} 90 ${y + 4}Z"/>` +
				line(p`M96 ${y + 11.5} q4 1.6 8 0`, "#ff9aa5", 1.8) +
				p`<path fill="none" stroke-width="2" d="M90 ${y + 4} Q100 ${y + 9} 110 ${y + 4} M85 ${y + 1} l-5 -3 M85 ${y + 8} l-5 3 M115 ${y + 1} l5 -3 M115 ${y + 8} l5 3"/>`
			);
	}
	return "";
}
function beardBack(f: Face, g: Geo, hr: Tones, sk: Skin): string
{
	const {L, R, b, ey, ny, my, w} = g;
	const hc = hr.base;
	const y = my;
	switch (f.facialHair)
	{
		case 3:
			// The full beard starts below the cheeks and leaves an opening, so cheeks and mouth show on any hair color.
			return (
				p`<path fill="${hc}" stroke-width="3.2" d="M${L + 3} ${ny + 18} Q${L + 2} ${b + 2} 100 ${b + 10} Q${R - 2} ${b + 2} ${R - 3} ${ny + 18} Q${R - 12} ${ny + 22} 122 ${my - 6} Q100 ${my - 14} 78 ${my - 6} Q${L + 12} ${ny + 22} ${L + 3} ${ny + 18}Z"/>` +
				flat(
					p`M${100 - w * 0.62} ${b - 12} Q100 ${b + 6} ${100 + w * 0.62} ${b - 12} Q100 ${b + 15} ${100 - w * 0.62} ${b - 12}Z`,
					hr.dark,
				) +
				strands(
					p`M${L + 11} ${my + 1} q0 9 6 14 M${R - 11} ${my + 1} q0 9 -6 14 M${100 - w * 0.3} ${b - 13} q2 7 5 9 M${100 + w * 0.3} ${b - 13} q-2 7 -5 9 M100 ${b - 8} v9`,
					hr,
				) +
				p`<ellipse fill="${sk.base}" cx="100" cy="${my + 8}" rx="21" ry="14"/>`
			);
		case 4:
			return (
				p`<path fill="${hc}" d="M90 ${y + 11} Q100 ${y + 7} 110 ${y + 11} L105 ${y + 28} Q100 ${y + 32} 95 ${y + 28}Z"/>` +
				strands(p`M97 ${y + 14} l1 10 M103 ${y + 14} l-1 10`, hr)
			);
		case 6:
		{
			// Sideburns start under the hair, so they join it, and run to the jaw short of the cheeks.
			const side = (x: number, s: number): string =>
				p`M${x - s * 3} ${ey - 18} L${x + s * 15} ${ey - 18} L${x + s * 17} ${ny + 14} Q${x + s * 11} ${ny + 27} ${x + s * 4} ${ny + 20}Z`;
			const comb = (x: number, s: number): string =>
				p`M${x + s * 5} ${ey + 22} l${s} 14 M${x + s * 10} ${ey + 14} l${s * 1.5} 18 M${x + s * 8} ${ny + 6} l${s} 10 `;
			return p`<path fill="${hc}" d="${side(L, 1)} ${side(R, -1)}"/>` + strands(comb(L, 1) + comb(R, -1), hr);
		}
		case 7:
		{
			// A goatee circles the mouth: mustache, chin and the strips that join them.
			const low = Math.min(y + 34, b + 5);
			return (
				p`<path fill="${hc}" d="M79 ${y - 8} Q100 ${y - 19} 121 ${y - 8} L122 ${y + 17} Q100 ${low + 4} 78 ${y + 17}Z"/>` +
				strands(p`M92 ${y + 20} l1.5 6 M100 ${y + 20} v8 M108 ${y + 20} l-1.5 6 M100 ${y - 13} v4.5`, hr) +
				p`<ellipse fill="${sk.base}" cx="100" cy="${y + 6}" rx="15" ry="10"/>`
			);
		}
		case 8:
		{
			// Mutton chops: sideburns that run under the cheeks and meet in a mustache, with the chin bare.
			const n = ny;
			const chop = (x: number, s: number): string =>
				p`M${x - s * 3} ${ey - 18} L${x + s * 13} ${ey - 18} L${x + s * 13} ${n + 18} Q${x + s * 16} ${n + 27} ${x + s * 30} ${n + 26} L${100 - s * 13} ${y - 9} Q${100 - s * 6} ${y - 13} 100 ${y - 8} L100 ${y - 3} Q${100 - s * 16} ${y - 1} ${x + s * 30} ${y + 11} Q${x + s * 10} ${y + 12} ${x + s * 3} ${n + 16}Z`;
			const comb = (x: number, s: number): string =>
				p`M${x + s * 5} ${ey + 22} l${s} 14 M${x + s * 9} ${ey + 14} l${s} 18 M${x + s * 9} ${n + 22} q${s * 6} 12 ${s * 18} 12 `;
			return p`<path fill="${hc}" d="${chop(L, 1)} ${chop(R, -1)}"/>` + strands(comb(L, 1) + comb(R, -1), hr);
		}
		case 9:
		{
			// A chin strap: one thin line of beard along the jaw, ear to ear.
			const d = p`M${L + 3} ${ny + 4} Q${L + 5} ${b - 7} 100 ${b - 3} Q${R - 5} ${b - 7} ${R - 3} ${ny + 4}`;
			return `<path d="${d}" fill="none" stroke-width="11"/><path d="${d}" fill="none" stroke="${hc}" stroke-width="7.4"/>`;
		}
		case 10:
			// A long chin beard that hangs to a point below the chin.
			return (
				p`<path fill="${hc}" d="M81 ${y + 9} Q100 ${y + 15} 119 ${y + 9} L113 ${b + 2} L100 ${b + 26} L87 ${b + 2}Z"/>` +
				flat(p`M100 ${y + 16} L112 ${b + 1} L100 ${b + 23}Z`, hr.dark) +
				strands(p`M92 ${y + 16} L96 ${b + 6} M100 ${y + 17} V${b + 14} M108 ${y + 16} L104 ${b + 6}`, hr)
			);
		case 5:
		{
			let s = "";
			for (const [u, v] of STUB) s += p`M${100 + u * w * 0.75} ${my - 6 + v * (b - my + 2)} l0.8 2.2 `;
			return line(s, darkSkin(f) ? shade(hc, 0.5) : shade(hc, -0.4), 2);
		}
	}
	return "";
}
function mustache(f: Face, g: Geo, hr: Tones): string
{
	const y = g.my;
	if (f.facialHair === 1)
		return (
			p`<path fill="${hr.base}" d="M83 ${y - 3} Q90 ${y - 14} 100 ${y - 7} Q110 ${y - 14} 117 ${y - 3} Q108 ${y - 3} 100 ${y - 4} Q92 ${y - 3} 83 ${y - 3}Z"/>` +
			strands(p`M100 ${y - 7} v2.5 M93 ${y - 8.5} q-3 1 -5 3.5 M107 ${y - 8.5} q3 1 5 3.5`, hr)
		);
	if (f.facialHair === 2)
	{
		// A handlebar: wide, with both ends curled up.
		const d = p`M100 ${y - 7} Q88 ${y - 15} 78 ${y - 3} Q72 ${y + 6} 66 ${y - 3} M100 ${y - 7} Q112 ${y - 15} 122 ${y - 3} Q128 ${y + 6} 134 ${y - 3}`;
		return (
			`<path d="${d}" fill="none" stroke-width="11.4"/><path d="${d}" fill="none" stroke="${hr.base}" stroke-width="8"/>` +
			strands(p`M97 ${y - 8.5} Q88 ${y - 13} 80 ${y - 5} M103 ${y - 8.5} Q112 ${y - 13} 120 ${y - 5}`, hr)
		);
	}
	return "";
}
function cheeks(f: Face, g: Geo, sk: Skin): string
{
	const {w, ny} = g;
	const cy = ny + 8,
		lx = 100 - w * 0.52,
		rx = 100 + w * 0.52;
	switch (f.cheeks)
	{
		case 1:
		{
			// A soft blush, hatched the way a colored pencil would.
			const hatch = (x: number): string =>
				p`M${x - 6} ${cy + 3} l3.5 -6 M${x - 1.5} ${cy + 3.5} l3.5 -6.5 M${x + 3} ${cy + 3} l3.5 -6 `;
			return (
				p`<g fill="#ff8fa3" opacity=".62" stroke="none"><ellipse cx="${lx}" cy="${cy}" rx="12.5" ry="8.5"/><ellipse cx="${rx}" cy="${cy}" rx="12.5" ry="8.5"/></g>` +
				line(hatch(lx) + hatch(rx), "#f0607c", FINE)
			);
		}
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
					s += p`<circle cx="${x + a}" cy="${cy + c}" r="2.2"/>`;
			}
			return `<g fill="${darkSkin(f) ? shade(sk.base, 0.5) : shade(sk.base, -0.5)}" stroke="none">${s}</g>`;
		}
		case 3:
		{
			// Two stripes of face paint on each cheek.
			const stripes = (x: number, s: number, dy: number): string =>
				p`M${x - s * 10} ${cy - 3 + dy} l${s * 19} -5 M${x - s * 10} ${cy + 6 + dy} l${s * 19} -5 `;
			return (
				line(stripes(lx, -1, 0) + stripes(rx, 1, 0), "#3a78f2", 5) +
				line(stripes(lx, -1, -1.2) + stripes(rx, 1, -1.2), "#8fb4ff", 1.2)
			);
		}
		case 4:
			return (
				p`<g transform="rotate(-25 ${lx} ${cy})"><rect x="${lx - 12}" y="${cy - 5}" width="24" height="10" rx="4" fill="#f3c999" stroke-width="2"/><rect x="${lx - 4}" y="${cy - 4}" width="8" height="8" fill="#e2a96f" stroke="none"/>` +
				line(p`M${lx - 8.5} ${cy - 1.5} v3 M${lx + 8.5} ${cy - 1.5} v3`, "#b98148", 1.4) +
				`</g>`
			);
		case 5:
			return (
				`<path d="${star(rx, cy, 12, 5.4)}" fill="#ffd23f" stroke-width="2"/>` +
				line(p`M${rx - 3.5} ${cy - 1} l2.5 -5`, "#fff3b8", 1.8)
			);
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
			return line("M20 237 H180 M16 247 H184", shade(c, -0.45), 4);
		case 2:
		{
			let s = "";
			for (const [x, y] of [
				[30, 244],
				[50, 232],
				[68, 246],
				[84, 238],
				[116, 238],
				[132, 246],
				[150, 232],
				[170, 244],
			] as const)
				s += `<circle cx="${x}" cy="${y}" r="3.6"/>`;
			return `<g fill="${CREAM}" stroke-width="1.5">${s}</g>`;
		}
		case 3:
			return `<g fill="${shade(c, -0.35)}" stroke-width="${MID}"><path d="M12 254 Q16 226 60 219 L46 254Z"/><path d="M188 254 Q184 226 140 219 L154 254Z"/></g>`;
		case 4:
			return (
				`<g fill="#3b3b45" stroke-width="${MID}"><path d="M65 222 L60 254 L72 254 L76 226Z"/><path d="M135 222 L140 254 L128 254 L124 226Z"/></g>` +
				`<g fill="${GOLD}" stroke-width="1.5"><circle cx="67" cy="243" r="2.6"/><circle cx="133" cy="243" r="2.6"/></g>`
			);
		case 5:
		{
			const d =
				"M16 247 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10";
			return `<path fill="none" stroke-width="8.4" d="${d}"/>` + line(d, CREAM, 5);
		}
	}
	return "";
}
function shirt(f: Face): string
{
	const c = CLOTH[f.shirt]!;
	const body = "M12 254 Q16 226 60 219 Q80 230 100 230 Q120 230 140 219 Q184 226 188 254Z";
	return (
		`<path d="${body}" fill="${c}" stroke-width="${OUT}"/>` +
		shirtPattern(f) +
		// The shoulder away from the light is in shadow; the near one catches it.
		`<path d="M146 221.5 Q181 228 186 252.2 L172 252.2 Q170 232 146 221.5Z" fill="#2a1408" opacity=".17" stroke="none"/>` +
		line("M22 242 Q27 229.5 55 223.5", light(c, 0.5), 2.6) +
		line("M38 252 q1 -8 7 -12 M162 252 q-1 -8 -7 -12", shade(c, -0.45), FINE) +
		// A ribbed neckline.
		line("M62 222.6 Q81 233.2 100 233.2 Q119 233.2 138 222.6", shade(c, -0.24), 4.2) +
		line("M61 225.4 Q80 236 100 236 Q120 236 139 225.4", shade(c, -0.5), 1.3)
	);
}
function neckwear(f: Face): string
{
	switch (f.neckwear)
	{
		case 1:
			return (
				`<path fill="#2c3e50" d="M100 225 Q90 214 83 215 Q80 225 83 235 Q90 236 100 225Z M100 225 Q110 214 117 215 Q120 225 117 235 Q110 236 100 225Z"/><rect fill="#2c3e50" x="95.6" y="220.4" width="8.8" height="9.2" rx="2.6"/>` +
				line(
					"M87 221 q4 1.5 6.5 4 M87 229.5 q4 -1.5 6.5 -4 M113 221 q-4 1.5 -6.5 4 M113 229.5 q-4 -1.5 -6.5 -4",
					"#7f95ab",
					1.4,
				)
			);
		case 2:
		{
			let s = "",
				glints = "";
			for (let i = 0; i < 9; i++)
			{
				const a = Math.PI * (0.15 + (0.7 * i) / 8);
				const x = 100 - Math.cos(a) * 24,
					y = 214 + Math.sin(a) * 16;
				s += p`<circle cx="${x}" cy="${y}" r="3.7"/>`;
				glints += p`<circle cx="${x + 1.2}" cy="${y + 1.2}" r="1.5"/>`;
			}
			return `<g fill="${CREAM}" stroke-width="1.5">${s}</g><g fill="#e6d3c3" stroke="none">${glints}</g>`;
		}
		case 3:
			return (
				`<path fill="#f39c12" d="M82 228 L74 253 L93 253 L95 231Z"/>` +
				line("M79 253 v-7 M84 253 v-7 M89 253 v-7", LINE, 1.8) +
				line("M79 236 l14.5 2.5 M77.5 242 l15.5 2.5", "#c0392b", 2.6) +
				`<path fill="#f39c12" d="M77 206 Q100 217 123 206 L126 224 Q100 237 74 224Z"/>` +
				line("M88 211 l-2 17 M100 213 v19 M112 211 l2 17", "#c0392b", 3) +
				line("M80 210.5 Q100 220.5 120 210.5", "#ffd27a", 1.6)
			);
		case 4:
			return (
				`<path fill="${CREAM}" d="M100 223 L83 213 L79 229 L93 233Z M100 223 L117 213 L121 229 L107 233Z"/><path fill="#8e44ad" d="M96 232 L104 232 L111 254 L89 254Z"/>` +
				line("M94 243 l11 -5 M91.5 251 l15.5 -7", "#b77fd0", 2) +
				`<path fill="#8e44ad" d="M93 221 L107 221 L104 232 L96 232Z"/>` +
				line("M96.5 224 q3.5 2 7 0", "#b77fd0", 1.5)
			);
		case 5:
		{
			const d = "M83 213 Q90 232 100 238 Q110 232 117 213";
			return (
				`<path fill="none" stroke-width="5.4" d="${d}"/>` +
				line(d, GOLD, 2.6) +
				`<path fill="#e5484d" stroke-width="2" d="M100 235 l7 8 l-7 9 l-7 -9Z"/>` +
				flat("M100 237.6 l-4.6 5.4 h4.6Z", "#ffb0ad")
			);
		}
		case 6:
			return (
				`<path fill="#2f6fde" d="M74 209 Q100 222 126 209 L100 251Z"/>` +
				line("M79.5 214 Q100 226 120.5 214", "#1f4fa8", 1.6) +
				`<g fill="${CREAM}" stroke="none"><circle cx="90" cy="223" r="2.4"/><circle cx="110" cy="223" r="2.4"/><circle cx="100" cy="230" r="2.4"/><circle cx="100" cy="241" r="2.4"/></g>`
			);
	}
	return "";
}
function glasses(f: Face, g: Geo): string
{
	const {ey: y, ex, L, R} = g;
	const lx = 100 - ex,
		rx = 100 + ex;
	const arms = (d: number): string =>
		p`<path fill="none" stroke-width="3" d="M${lx + d} ${y - 2} Q100 ${y - 8} ${rx - d} ${y - 2} M${lx - d} ${y - 2} L${L - 1} ${y - 6} M${rx + d} ${y - 2} L${R + 1} ${y - 6}"/>`;
	switch (f.glasses)
	{
		case 1:
			return (
				p`<g fill="none" stroke-width="3.2"><circle cx="${lx}" cy="${y}" r="18"/><circle cx="${rx}" cy="${y}" r="18"/></g>` +
				arms(18)
			);
		case 2:
			return (
				p`<g fill="none" stroke-width="3.2"><rect x="${lx - 19}" y="${y - 17}" width="38" height="34" rx="6"/><rect x="${rx - 19}" y="${y - 17}" width="38" height="34" rx="6"/></g>` +
				arms(19)
			);
		case 3:
		{
			// Aviators: thin gold teardrop frames with a top bar, and clear lenses like every other pair.
			const lens = (x: number, s: number): string =>
				p`M${x - s * 17} ${y - 18} L${x + s * 19} ${y - 19} Q${x + s * 26} ${y + 8} ${x + s * 5} ${y + 22} Q${x - s * 18} ${y + 23} ${x - s * 17} ${y - 18}Z`;
			const d = p`${lens(lx, -1)} ${lens(rx, 1)} M${lx + 17} ${y - 17} L${rx - 17} ${y - 17}`;
			return `<path fill="none" stroke-width="5.8" d="${d}"/>` + line(d, GOLD, 2.6) + arms(18);
		}
		case 4:
			return (
				p`<circle cx="${rx}" cy="${y}" r="18.4" fill="none" stroke-width="5"/><circle cx="${rx}" cy="${y}" r="18.4" fill="none" stroke="#d9ae2c" stroke-width="2.6"/>` +
				p`<path fill="none" stroke="#c9a227" stroke-width="2" stroke-dasharray="3 3" d="M${rx + 13} ${y + 14} Q${rx + 22} ${y + 40} ${rx + 8} ${y + 62}"/>`
			);
		case 5:
		{
			// Cat-eye frames: the outer corners sweep up, and the lens stays wider than the largest eye.
			const lens = (x: number, s: number): string =>
				p`M${x - s * 18} ${y - 12} Q${x} ${y - 21} ${x + s * 27} ${y - 24} Q${x + s * 23} ${y + 14} ${x + s * 3} ${y + 19} Q${x - s * 18} ${y + 18} ${x - s * 18} ${y - 12}Z`;
			const rim = (x: number, s: number): string =>
				p`M${x - s * 14} ${y - 15} Q${x} ${y - 22} ${x + s * 24} ${y - 24.6} `;
			return (
				line(
					p`${lens(lx, -1)} ${lens(rx, 1)} M${lx + 18} ${y - 4} Q100 ${y - 9} ${rx - 18} ${y - 4}`,
					"#ff4fa0",
					4.5,
				) + line(rim(lx, -1) + rim(rx, 1), "#ffb5d8", 1.3)
			);
		}
	}
	return "";
}
const LIFT: Record<number, number> =
{
	1: 10,
	8: 8,
	2: 4,
	3: 4,
	12: 8,
	13: 4,
};
// How far each hair style rises above the top of the head, so a hat perched on the crown sits on the hair.
const CROWN: Record<number, number> =
{
	1: 9,
	2: 6,
	3: 6,
	5: 6,
	7: 6,
	9: 8,
	10: 8,
	11: 6,
	12: 21,
	13: 6,
};
// Where a hat sits: the height of its brim and its half width. A hat perches up on the crown of the hair, so the
// hairline, the fringe and the sides of any hair style show under it.
function hatSeat(
	f: Face,
	g: Geo,
):
{
	afro: boolean;
	lift: number;
	hy: number;
	hw: number;
}
{
	const afro = f.hairStyle === 4;
	return {
		afro,
		lift: LIFT[f.hairStyle] ?? 0,
		hy: afro ? g.t + 38 - g.w : g.t + 4 - (CROWN[f.hairStyle] ?? 0),
		hw: g.w * (afro ? 0.74 : 0.72),
	};
}
// The shadow a brim casts on the top of the head: a dark sliver that shows below the hat drawn over it.
function hatShadow(f: Face, g: Geo): string
{
	const {hy, hw} = hatSeat(f, g);
	const cast = (
		{
			1: [4, hw * 0.9, 5],
			3: [3, hw * 0.9, 4],
			8: [3, hw, 5],
		} as Record<number, [number, number, number]>
	)[f.hat];
	if (!cast) return "";
	return p`<ellipse cx="100" cy="${hy + cast[0]}" rx="${cast[1]}" ry="${cast[2]}" fill="#2a1408" opacity=".2" stroke="none"/>`;
}
function hat(f: Face, g: Geo): string
{
	if (!f.hat) return "";
	const {w, t, ey, L, R} = g;
	const {afro, lift, hy, hw} = hatSeat(f, g);
	const c = HATC[f.hatColor]!;
	const dim = shade(c, -0.2),
		deep = shade(c, -0.45),
		lit = light(c, 0.5);
	const big = `stroke-width="${OUT}"`;
	const dome = (h: number): string =>
		p`M${100 - hw} ${hy} Q${100 - hw} ${hy - h} 100 ${hy - h - 2} Q${100 + hw} ${hy - h} ${100 + hw} ${hy}Z`;
	// The light catches the top left of a domed hat.
	const sheen = (h: number): string =>
		line(
			p`M${100 - hw * 0.8} ${hy - h * 0.34} Q${100 - hw * 0.72} ${hy - h * 0.74} ${100 - hw * 0.4} ${hy - h * 0.9}`,
			lit,
			3,
		);
	const pompom = (x: number, y: number, r: number): string =>
		p`<circle fill="${CREAM}" cx="${x}" cy="${y}" r="${r}"/>` +
		line(
			p`M${x - r * 0.5} ${y - r * 0.1} q${r * 0.2} ${-r * 0.5} ${r * 0.6} ${-r * 0.45} M${x - r * 0.1} ${y + r * 0.5} q${r * 0.4} ${r * 0.1} ${r * 0.6} ${-r * 0.3}`,
			"#cdbba8",
			1.4,
		);
	const sink = afro ? 0 : Math.max(0, 9 - (CROWN[f.hairStyle] ?? 0));
	const band = p`M${100 - w + 4} ${t + 30 + sink} C${100 - w - 4} ${t - 24 + sink} ${100 + w + 4} ${t - 24 + sink} ${100 + w - 4} ${t + 30 + sink}`;
	const hairband = (col: string): string =>
		`<path d="${band}" fill="none" stroke-width="9.8"/>` + line(band, col, 6) + line(band, light(col, 0.4), 1.2);
	switch (f.hat)
	{
		case 1:
		{
			// A ball cap worn with its bill swung out to one side, so its outline is unlike any other dome.
			const bill = p`M${100 + hw * 0.55} ${hy - 6} Q${100 + hw + 14} ${hy - 9} ${100 + hw + 25} ${hy - 1} Q${100 + hw + 27} ${hy + 5} ${100 + hw + 18} ${hy + 6} Q${100 + hw * 0.8} ${hy + 6} ${100 + hw * 0.4} ${hy + 3}Z`;
			return (
				p`<path fill="${dim}" ${big} d="${bill}"/>` +
				line(
					p`M${100 + hw * 0.7} ${hy + 0.5} Q${100 + hw + 10} ${hy - 1} ${100 + hw + 21} ${hy + 2}`,
					deep,
					1.3,
				) +
				`<path fill="${c}" ${big} d="${dome(30)}"/>` +
				line(
					p`M100 ${hy - 31} V${hy - 2} M${100 - hw * 0.55} ${hy - 2} Q${100 - hw * 0.5} ${hy - 22} 100 ${hy - 31} M${100 + hw * 0.55} ${hy - 2} Q${100 + hw * 0.5} ${hy - 22} 100 ${hy - 31}`,
					deep,
					1.5,
				) +
				sheen(30) +
				p`<rect fill="${dim}" stroke-width="2.4" x="${100 - hw}" y="${hy - 6}" width="${2 * hw}" height="7" rx="3"/>` +
				p`<circle fill="${CREAM}" stroke-width="2" cx="100" cy="${hy - 32}" r="3.6"/>`
			);
		}
		case 2:
		{
			// Headphones: a band over the top of the head and a big cup over each ear, so the hair shows between.
			const top = t - 40,
				lx = L - 6,
				rx = R + 6,
				cy = ey + 6;
			const arc = p`M${lx - 4} ${cy - 13} C${lx - 14} ${top} ${rx + 14} ${top} ${rx + 4} ${cy - 13}`;
			const cup = (x: number, s: number): string =>
				p`<rect fill="#3a3330" stroke-width="2.6" x="${x + s * 5 - 4}" y="${cy - 14}" width="8" height="28" rx="4"/>` +
				p`<ellipse fill="${c}" ${big} cx="${x - s * 2}" cy="${cy}" rx="11" ry="16"/>` +
				p`<ellipse fill="${dim}" stroke="none" cx="${x - s * 4}" cy="${cy + 2}" rx="5.5" ry="10"/>` +
				line(p`M${x - 7} ${cy - 6} Q${x - 5} ${cy - 12} ${x} ${cy - 13}`, lit, 2.2);
			return (
				`<path d="${arc}" fill="none" stroke-width="10.4"/>` +
				line(arc, c, 6.6) +
				line(arc, lit, 1.4) +
				cup(lx, -1) +
				cup(rx, 1)
			);
		}
		case 3:
			return (
				p`<path fill="#2f2a28" ${big} d="M${100 - hw * 0.62} ${hy} L${100 - hw * 0.68} ${hy - 44} Q100 ${hy - 48} ${100 + hw * 0.68} ${hy - 44} L${100 + hw * 0.62} ${hy}Z"/>` +
				line(p`M${100 - hw * 0.46} ${hy - 38} L${100 - hw * 0.44} ${hy - 20}`, "#6f6660", 3) +
				p`<path fill="${c}" d="M${100 - hw * 0.64} ${hy - 15} L${100 + hw * 0.64} ${hy - 15} L${100 + hw * 0.63} ${hy - 6} L${100 - hw * 0.63} ${hy - 6}Z"/>` +
				line(p`M${100 - hw * 0.54} ${hy - 12.4} H${100 + hw * 0.2}`, lit, 1.4) +
				p`<ellipse fill="#2f2a28" ${big} cx="100" cy="${hy}" rx="${hw + 10}" ry="6"/>` +
				line(
					p`M${100 - hw - 3} ${hy - 1} Q${100 - hw * 0.4} ${hy - 4} ${100 + hw * 0.1} ${hy - 3.6}`,
					"#6f6660",
					1.8,
				)
			);
		case 4:
		{
			const tips = [-0.82, 0, 0.82]
				.map(
					(u) =>
						p`<circle fill="#f5c542" stroke-width="2" cx="${100 + hw * u}" cy="${hy - (u ? 28 : 34)}" r="3.6"/>`,
				)
				.join("");
			return (
				p`<path fill="#f5c542" ${big} d="M${100 - hw * 0.76} ${hy + 1} L${100 - hw * 0.82} ${hy - 27} L${100 - hw * 0.42} ${hy - 12} L100 ${hy - 33} L${100 + hw * 0.42} ${hy - 12} L${100 + hw * 0.82} ${hy - 27} L${100 + hw * 0.76} ${hy + 1}Z"/>` +
				flat(
					p`M${100 + hw * 0.48} ${hy - 10} L${100 + hw * 0.8} ${hy - 22} L${100 + hw * 0.75} ${hy} L${100 + hw * 0.48} ${hy}Z`,
					"#dfa326",
				) +
				line(p`M${100 - hw * 0.72} ${hy - 8} L${100 - hw * 0.76} ${hy - 20}`, "#fff0a6", 2.4) +
				line(p`M${100 - hw * 0.77} ${hy - 10} H${100 + hw * 0.77}`, "#b97f14", 1.4) +
				tips +
				p`<circle cx="100" cy="${hy - 4.5}" r="4" fill="#e74c3c" stroke-width="2"/><circle cx="${100 - hw * 0.45}" cy="${hy - 4.5}" r="3.2" fill="#3498db" stroke-width="2"/><circle cx="${100 + hw * 0.45}" cy="${hy - 4.5}" r="3.2" fill="#3498db" stroke-width="2"/>` +
				p`<g fill="#fff" stroke="none" opacity=".8"><circle cx="98.6" cy="${hy - 5.8}" r="1.2"/><circle cx="${100 - hw * 0.45 - 1}" cy="${hy - 5.6}" r="1"/><circle cx="${100 + hw * 0.45 - 1}" cy="${hy - 5.6}" r="1"/></g>`
			);
		}
		case 5:
		{
			const bx = 100 - w * 0.5,
				by = t + 4 - (afro ? 20 : lift);
			const loop = (s: number): string =>
				p`M${bx} ${by} Q${bx + s * 9} ${by - 17} ${bx + s * 20} ${by - 13} Q${bx + s * 24} ${by} ${bx + s * 20} ${by + 13} Q${bx + s * 9} ${by + 17} ${bx} ${by}Z`;
			return (
				hairband(c) +
				`<path fill="${c}" d="${loop(-1)} ${loop(1)}"/>` +
				line(
					p`M${bx - 6} ${by - 1} q-6 -4 -11 -2 M${bx - 6} ${by + 2} q-5 3 -10 3 M${bx + 6} ${by - 1} q6 -4 11 -2 M${bx + 6} ${by + 2} q5 3 10 3`,
					deep,
					1.5,
				) +
				line(p`M${bx - 16} ${by - 9.5} q4 -2 8 0`, lit, 1.8) +
				p`<circle fill="${c}" cx="${bx}" cy="${by}" r="6"/>`
			);
		}
		case 6:
			return (
				p`<path fill="${c}" ${big} d="M74 ${hy} L106 ${hy - 66} L130 ${hy + 2}Z"/>` +
				flat(p`M106.4 ${hy - 62} L128 ${hy + 0.4} L115 ${hy + 0.2}Z`, dim) +
				line(p`M80.5 ${hy - 7} L100 ${hy - 47}`, lit, 2.6) +
				p`<g fill="${CREAM}" stroke="none"><circle cx="96" cy="${hy - 14}" r="3.5"/><circle cx="110" cy="${hy - 30}" r="3.5"/><circle cx="104" cy="${hy - 48}" r="3"/><circle cx="116" cy="${hy - 10}" r="3.5"/><circle cx="86" cy="${hy - 4}" r="3"/></g>` +
				pompom(106, hy - 68, 7)
			);
		case 7:
		{
			// A propeller beanie: a small round dome in bright stripes, with the propeller spinning on top.
			const gore = (s: number): string =>
				p`M${100 + s * hw * 0.62} ${hy} Q${100 + s * hw * 0.6} ${hy - 18} ${100 + s * hw * 0.06} ${hy - 27.5} Q${100 + s * hw * 0.28} ${hy - 14} ${100 + s * hw * 0.22} ${hy}Z`;
			return (
				`<path fill="${c}" ${big} d="${dome(26)}"/>` +
				flat(gore(-1) + gore(1), "#f1c40f") +
				line(gore(-1) + gore(1), LINE, 1.4) +
				sheen(26) +
				p`<rect fill="#2e86de" stroke-width="2.4" x="${100 - hw}" y="${hy - 4}" width="${2 * hw}" height="6" rx="3"/>` +
				p`<path d="M100 ${hy - 28} L100 ${hy - 38}" fill="none"/>` +
				p`<path fill="#e74c3c" stroke-width="2.2" d="M100 ${hy - 40} Q88 ${hy - 48} 77 ${hy - 43} Q88 ${hy - 37} 100 ${hy - 40}Z"/>` +
				p`<path fill="#2e86de" stroke-width="2.2" d="M100 ${hy - 40} Q112 ${hy - 33} 123 ${hy - 37} Q112 ${hy - 44} 100 ${hy - 40}Z"/>` +
				p`<circle fill="#f1c40f" stroke-width="2" cx="100" cy="${hy - 40}" r="3"/>`
			);
		}
		case 8:
			return (
				p`<ellipse fill="#9a7650" ${big} cx="100" cy="${hy}" rx="${hw + 16}" ry="6.5"/>` +
				p`<path fill="#9a7650" ${big} d="M${100 - hw * 0.74} ${hy} Q${100 - hw * 0.82} ${hy - 32} ${100 - hw * 0.36} ${hy - 36} Q100 ${hy - 27} ${100 + hw * 0.36} ${hy - 36} Q${100 + hw * 0.82} ${hy - 32} ${100 + hw * 0.74} ${hy}Z"/>` +
				flat(
					p`M${100 + hw * 0.4} ${hy - 33} Q${100 + hw * 0.76} ${hy - 30} ${100 + hw * 0.7} ${hy - 12} L${100 + hw * 0.44} ${hy - 12} Q${100 + hw * 0.54} ${hy - 24} ${100 + hw * 0.4} ${hy - 33}Z`,
					"#7f5f3e",
				) +
				line(p`M100 ${hy - 29} q-2 7 0 13`, "#6b4e31", FINE) +
				line(
					p`M${100 - hw * 0.62} ${hy - 16} Q${100 - hw * 0.64} ${hy - 28} ${100 - hw * 0.38} ${hy - 31}`,
					"#c4a078",
					2.6,
				) +
				p`<path fill="${c}" d="M${100 - hw * 0.76} ${hy - 11} L${100 + hw * 0.76} ${hy - 11} L${100 + hw * 0.75} ${hy - 2.5} L${100 - hw * 0.75} ${hy - 2.5}Z"/>` +
				line(p`M${100 - hw * 0.66} ${hy - 8.4} H${100 + hw * 0.2}`, lit, 1.4) +
				line(
					p`M${100 - hw - 8} ${hy + 2} Q${100 - hw * 0.3} ${hy + 5} ${100 + hw * 0.3} ${hy + 4.2}`,
					"#c4a078",
					1.6,
				)
			);
		case 9:
			// A beret: a wide, flat disc of felt tipped down over one side, with a little stalk in the middle.
			return (
				p`<g transform="rotate(-9 100 ${hy})">` +
				p`<path fill="${dim}" stroke-width="2.6" d="M${100 - hw * 0.8} ${hy - 4} H${100 + hw * 0.8} V${hy + 3} Q100 ${hy + 6} ${100 - hw * 0.8} ${hy + 3}Z"/>` +
				p`<path fill="${c}" ${big} d="M${100 - hw - 9} ${hy - 4} Q${100 - hw - 12} ${hy - 19} ${100 - 6} ${hy - 21} Q${100 + hw + 22} ${hy - 22} ${100 + hw + 18} ${hy - 7} Q${100 + hw + 10} ${hy + 1} 100 ${hy} Q${100 - hw - 6} ${hy + 1} ${100 - hw - 9} ${hy - 4}Z"/>` +
				line(p`M${100 - hw * 0.2} ${hy - 4} Q${100 + hw + 4} ${hy - 4} ${100 + hw + 12} ${hy - 9}`, dim, 3) +
				line(
					p`M${100 - hw - 4} ${hy - 11} Q${100 - hw * 0.7} ${hy - 19} ${100 - hw * 0.1} ${hy - 19}`,
					lit,
					3,
				) +
				p`<path fill="none" stroke-width="3" d="M102 ${hy - 21} l2 -7"/>` +
				`</g>`
			);
		case 10:
		case 11:
		{
			const by = t + 2 + sink - (afro ? 20 : lift);
			const cat = f.hat === 10,
				col = cat ? "#2b2b2b" : "#d92b2b";
			const ear = (s: number): string =>
			{
				const x = 100 + s * w * 0.55;
				return cat
					? p`<path fill="${col}" ${big} d="M${x - 21} ${by + 6} L${x + s * 6} ${by - 44} L${x + 21} ${by + 6}Z"/><path fill="#ffb3c7" stroke="none" d="M${x - 10} ${by + 1} L${x + s * 5} ${by - 27} L${x + 11} ${by + 1}Z"/>` +
							line(p`M${x - 2} ${by - 1} l${s * 2.5} -8 M${x + 4} ${by - 1} l${s} -6`, "#f08aa6", 1.4)
					: p`<path fill="${col}" ${big} d="M${x - 10} ${by + 5} Q${x - s * 6} ${by - 22} ${x + s * 20} ${by - 38} Q${x + s * 16} ${by - 8} ${x + 10} ${by + 5}Z"/>` +
							line(
								p`M${x - s * 3} ${by - 4} Q${x + s * 2} ${by - 19} ${x + s * 13} ${by - 29}`,
								"#ff8f7e",
								2.2,
							);
			};
			return ear(-1) + ear(1) + hairband(col);
		}
	}
	return "";
}

function paint(f: Face): string
{
	const g = geo(f),
		sk = skinOf(f),
		natural = tonesOf(HAIRC[f.hairColor]!),
		// Dye colors the hair on the head; eyebrows and facial hair keep the natural color.
		dyed = f.hairDye ? tonesOf(DYEC[f.hairDye]!) : natural;
	const head = headShape(f.faceShape, g);
	const hair = hairFront(f, g, dyed, sk);
	const onFace = (inner: string): string => (darkSkin(f) ? `<g stroke="${sk.line}">${inner}</g>` : inner);
	const s =
		hairBack(f, g, dyed) +
		p`<path d="M86 ${g.b - 16} L86 228 L114 228 L114 ${g.b - 16}Z" fill="${sk.base}" stroke-width="3.2"/>` +
		// The chin casts a shadow on the neck.
		flat(p`M87.6 ${g.b - 12} L112.4 ${g.b - 12} L112.4 ${g.b + 5} Q100 ${g.b + 13} 87.6 ${g.b + 5}Z`, sk.shadow) +
		shirt(f) +
		neckwear(f) +
		ears(f, g, sk) +
		`<g fill="${sk.base}" stroke="none">${head}</g>` +
		// Inside the head: a shadow down the side away from the light, and the one the hair casts on the forehead.
		`<g clip-path="url(#storybook-head-${f.faceShape})" stroke="none"><g fill="${sk.shadow}">${head}</g><g fill="${sk.base}" transform="translate(-4 -4.5)">${head}</g><g fill="${sk.shadow}" transform="translate(0 4.5)">${hair.body}</g></g>` +
		`<g fill="none" stroke-width="${OUT}">${head}</g>` +
		// Where the chin crosses the neck there is skin on both sides of the outline, so on the darkest skins that stretch
		// is redrawn in the face line.
		(darkSkin(f) ? `<g clip-path="url(#storybook-neck)" fill="none" stroke="${sk.line}">${head}</g>` : "") +
		onFace(cheeks(f, g, sk) + beardBack(f, g, natural, sk)) +
		`<g fill="${dyed.base}" stroke-width="${OUT}">${hair.body}</g>` +
		hair.detail +
		`<g clip-path="url(#storybook-head-${f.faceShape})">${hatShadow(f, g)}</g>` +
		eyes(f, g, sk) +
		onFace(brows(f, g, natural.base) + nose(f, g, sk) + mouth(f, g, sk) + mustache(f, g, natural) + glasses(f, g)) +
		hat(f, g);
	return `<g filter="url(#storybook-ink)" stroke="${LINE}" stroke-width="${MID}" stroke-linejoin="round" stroke-linecap="round">${HEAD_CLIPS[f.faceShape]}${darkSkin(f) ? NECK_CLIP : ""}${s}</g>`;
}

// A picture-book take on the notebook sketch: brown ink in three weights, two-tone shading and a pencil grain.
export const storybook: ArtStyle =
{
	id: "storybook",
	name: "Storybook",
	blurb: "A richer hand-drawn look with shading.",
	defs:
		HEAD_CLIPS.join("") +
		NECK_CLIP +
		`<filter id="storybook-ink" filterUnits="userSpaceOnUse" x="-40" y="-80" width="280" height="360" color-interpolation-filters="sRGB">` +
		`<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="wave"/>` +
		`<feDisplacementMap in="SourceGraphic" in2="wave" scale="2.8" xChannelSelector="R" yChannelSelector="G" result="drawn"/>` +
		`<feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="9" result="grain"/>` +
		`<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.17  0 0 0 0 0.08  0.4 0 0 0 -0.18" result="pencil"/>` +
		`<feComposite in="pencil" in2="drawn" operator="in" result="shade"/>` +
		`<feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.9  0 0.32 0 0 -0.17" result="tooth"/>` +
		`<feComposite in="tooth" in2="drawn" operator="in" result="paper"/>` +
		`<feMerge><feMergeNode in="drawn"/><feMergeNode in="shade"/><feMergeNode in="paper"/></feMerge></filter>`,
	paint,
};
