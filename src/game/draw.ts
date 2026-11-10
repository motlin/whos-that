import {CLOTH, DYEC, EYEC, type Face, type FeatureKey, HAIRC, HATC, SKIN} from "./faces.ts";

const INK = "#2a2522";
// Ink disappears on the two darkest skins, so lines drawn on the skin there use a warm tone a few shades lighter than
// the skin. The eyes keep their ink outline on every skin: the whites already stand out.
const FACE_LINE = [INK, INK, INK, "#e8bd92", "#c9905f"];
const darkSkin = (f: Face): boolean => f.skin >= 3;
const SHAPES = [
	{
		w: 60,
		t: 44,
		b: 196,
	},
	{
		w: 71,
		t: 60,
		b: 188,
	},
	{
		w: 62,
		t: 48,
		b: 194,
	},
	{
		w: 49,
		t: 30,
		b: 206,
	},
	{
		w: 62,
		t: 46,
		b: 200,
	},
];
interface Geo
{
	w: number;
	t: number;
	b: number;
	L: number;
	R: number;
	ey: number;
	ny: number;
	my: number;
	ex: number;
	cy: number;
	ry: number;
}
type Region = [number, number, number, number];

function geo(f: Face): Geo
{
	const s = SHAPES[f.faceShape]!,
		h = s.b - s.t;
	return {
		...s,
		L: 100 - s.w,
		R: 100 + s.w,
		ey: s.t + h * 0.42,
		ny: s.t + h * 0.6,
		my: s.t + h * 0.76,
		ex: s.w * 0.42,
		cy: (s.t + s.b) / 2,
		ry: h / 2,
	};
}
function shade(hex: string, p: number): string
{
	const n = parseInt(hex.slice(1), 16);
	const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
		Math.max(0, Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p))),
	);
	return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function star(cx: number, cy: number, R: number, r: number, n = 5): string
{
	let d = "";
	for (let i = 0; i < n * 2; i++)
	{
		const a = -Math.PI / 2 + (i * Math.PI) / n,
			rr = i % 2 ? r : R;
		d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1);
	}
	return d + "Z";
}
const N1 = (v: number): string => v.toFixed(1);
const STUB = ((): [number, number][] =>
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

function headShape(f: Face, g: Geo): string
{
	const {w, t, b, cy, ry} = g;
	if (f.faceShape === 2) return `<rect x="${100 - w}" y="${t}" width="${2 * w}" height="${b - t}" rx="28"/>`;
	if (f.faceShape === 4)
		return `<path d="M${100 - w} ${t + 50} Q${100 - w} ${t} 100 ${t} Q${100 + w} ${t} ${100 + w} ${t + 50} Q${100 + w - 4} ${b - 40} 100 ${b} Q${100 - w + 4} ${b - 40} ${100 - w} ${t + 50}Z"/>`;
	return `<ellipse cx="100" cy="${cy}" rx="${w}" ry="${ry}"/>`;
}
function hairBack(f: Face, g: Geo, hc: string): string
{
	const {w, t, ey, L, R} = g;
	const st = `fill="${hc}"`;
	switch (f.hairStyle)
	{
		case 2:
			return `<rect ${st} x="${L - 12}" y="${t - 8}" width="${2 * w + 24}" height="${ey + 48 - t}" rx="34"/>`;
		case 3:
			return `<path ${st} d="M${L - 14} ${t + 34} Q${L - 16} ${t - 12} 100 ${t - 12} Q${R + 16} ${t - 12} ${R + 14} ${t + 34} L${R + 22} 236 Q100 246 ${L - 22} 236Z"/>`;
		case 4:
		{
			const cy = t + 34,
				r = w + 20;
			let p = `<circle ${st} cx="100" cy="${cy}" r="${r}"/>`;
			for (let i = 0; i < 14; i++)
			{
				const a = Math.PI * (0.8 + (i * 1.4) / 13);
				p += `<circle ${st} cx="${N1(100 + Math.cos(a) * r)}" cy="${N1(cy + Math.sin(a) * r)}" r="15"/>`;
			}
			return p;
		}
		case 5:
			return `<ellipse ${st} cx="${R + 17}" cy="${t + 64}" rx="16" ry="40" transform="rotate(22 ${R + 17} ${t + 64})"/><circle fill="#ff4d6d" cx="${R + 4}" cy="${t + 32}" r="6.5"/>`;
		case 7:
			return `<circle ${st} cx="${L + 4}" cy="${t + 2}" r="23"/><circle ${st} cx="${R - 4}" cy="${t + 2}" r="23"/>`;
		case 11:
		{
			// Two braids hang beside the neck, each a chain of knots with a tie at the end.
			let p = "";
			for (const x of [L - 9, R + 9])
			{
				for (let i = 0; i < 5; i++)
					p += `<ellipse ${st} cx="${x + (i % 2 ? 2 : -2)}" cy="${N1(ey + 28 + i * 15)}" rx="10" ry="10.5"/>`;
				p += `<circle fill="#ff4d6d" cx="${x}" cy="${N1(ey + 102)}" r="5.5"/>`;
			}
			return p;
		}
	}
	return "";
}
function hairFront(f: Face, g: Geo, hc: string): string
{
	const {w, t, ey, L, R, cy, ry} = g;
	const fb = ey - 28;
	const st = `fill="${hc}"`;
	const P = (th: number, e = 0): [string, string] => [
		N1(100 + (w + 3 + e) * Math.cos(th)),
		N1(cy + (ry + 3 + e) * Math.sin(th)),
	];
	const cap = `M${L - 3} ${ey - 8} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 3} ${ey - 8}`;
	switch (f.hairStyle)
	{
		case 0:
			return `<path d="M${N1(100 - w * 0.45)} ${t + 16} q12 -8 24 -5" stroke="#fff" stroke-width="4" fill="none" opacity=".85"/>`;
		case 5:
			return `<path ${st} d="${cap} Q${R - 2} ${fb + 2} ${R - 14} ${fb} Q100 ${fb - 16} ${L + 14} ${fb} Q${L + 2} ${fb + 2} ${L - 3} ${ey - 8}Z"/>`;
		case 1:
		{
			const pts: (string | number)[][] = [[L - 3, ey - 12]];
			const N = 12;
			for (let i = 0; i <= N; i++)
			{
				const th = Math.PI * (1.08 + (0.84 * i) / N);
				pts.push(P(th, i % 2 ? 20 : 0));
			}
			pts.push([R + 3, ey - 12]);
			for (let i = 0; i <= 7; i++)
			{
				pts.push([N1(R - 4 - ((2 * w - 8) * i) / 7), i % 2 ? fb - 9 : fb]);
			}
			return `<path ${st} d="M${pts.map((p) => p.join(" ")).join(" L")}Z"/>`;
		}
		case 2:
			return `<path ${st} d="M${L - 4} ${ey - 4} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 4} ${ey - 4} L${R - 6} ${ey - 6} L${R - 8} ${fb} L${L + 8} ${fb} L${L + 6} ${ey - 6}Z"/>`;
		case 3:
			return `<path ${st} d="M${L - 4} ${ey + 6} C${L - 8} ${t - 30} ${R + 8} ${t - 30} ${R + 4} ${ey + 6} Q${R - 4} ${fb} ${R - 20} ${fb - 2} Q100 ${fb - 6} 84 ${t + 10} Q${L + 12} ${fb + 4} ${L + 5} ${ey + 6}Z"/>`;
		case 4:
			return `<path ${st} d="M${L - 2} ${ey - 10} C${L - 6} ${t - 28} ${R + 6} ${t - 28} ${R + 2} ${ey - 10} Q${R - 6} ${fb} 100 ${fb - 8} Q${L + 6} ${fb} ${L - 2} ${ey - 10}Z"/>`;
		case 6:
			return `<path ${st} d="M88 ${t + 26} L85 ${t - 6} L92 ${t - 22} L96 ${t - 13} L100 ${t - 38} L104 ${t - 13} L108 ${t - 22} L115 ${t - 6} L112 ${t + 26}Z"/>`;
		case 7:
			return `<path ${st} d="${cap} Q${R - 4} ${fb} 106 ${fb - 6} L100 ${t + 6} L94 ${fb - 6} Q${L + 4} ${fb} ${L - 3} ${ey - 8}Z"/>`;
		case 8:
		{
			let p = `<path ${st} d="M${L - 2} ${ey - 10} C${L - 6} ${t - 28} ${R + 6} ${t - 28} ${R + 2} ${ey - 10} Q${R - 6} ${fb} 100 ${fb - 6} Q${L + 6} ${fb} ${L - 2} ${ey - 10}Z"/>`;
			// The curls stop above the ears, so ears and earrings stay in sight.
			for (let i = 0; i < 11; i++)
			{
				const [x, y] = P(Math.PI * (1.15 + (i * 0.7) / 10), 2);
				p += `<circle ${st} cx="${x}" cy="${y}" r="11"/>`;
			}
			return p;
		}
		case 9:
		{
			// Balding: a tuft over each ear and a bare, shiny top.
			const side = (x: number, s: number): string =>
				`M${x - s * 4} ${ey + 2} C${x - s * 12} ${t + 30} ${x + s * 2} ${t + 10} ${x + s * 17} ${t + 15} Q${x + s * 8} ${t + 40} ${x + s * 9} ${ey + 2}Z`;
			return `<path ${st} d="${side(L, 1)} ${side(R, -1)}"/><path d="M${N1(100 - w * 0.3)} ${t + 14} q12 -8 24 -5" stroke="#fff" stroke-width="4" fill="none" opacity=".85"/>`;
		}
		case 10:
			// A side part: the hair piles high on one side and sweeps down across the forehead.
			return `<path ${st} d="M${L - 3} ${ey - 8} C${L - 6} ${t - 14} ${L + 18} ${t - 22} ${L + 24} ${t - 8} C${L + 40} ${t - 44} ${R + 16} ${t - 40} ${R + 3} ${ey - 8} Q${R - 2} ${fb + 6} ${R - 14} ${fb + 6} Q100 ${fb - 2} ${L + 24} ${t + 8} Q${L + 10} ${fb - 6} ${L - 3} ${ey - 8}Z"/><path fill="none" d="M${L + 24} ${t + 8} L${L + 24} ${t - 8}"/>`;
		case 11:
			return `<path ${st} d="${cap} Q${R - 4} ${fb} 106 ${fb - 6} L100 ${t + 6} L94 ${fb - 6} Q${L + 4} ${fb} ${L - 3} ${ey - 8}Z"/>`;
		case 12:
			// A flat-top: straight sides and a level top.
			return `<path ${st} d="M${L - 3} ${ey - 8} L${L - 6} ${t - 24} L${R + 6} ${t - 24} L${R + 3} ${ey - 8} Q${R - 4} ${fb + 2} 100 ${fb - 4} Q${L + 4} ${fb + 2} ${L - 3} ${ey - 8}Z"/>`;
		case 13:
			// A bowl cut: a round cap with a straight fringe just above the eyebrows.
			return `<path ${st} d="M${L - 5} ${ey - 2} C${L - 12} ${t - 34} ${R + 12} ${t - 34} ${R + 5} ${ey - 2} L${R - 5} ${ey - 2} L${R - 6} ${fb + 5} L${L + 6} ${fb + 5} L${L + 5} ${ey - 2}Z"/><path d="M${N1(100 - w * 0.5)} ${t + 2} q${N1(w * 0.5)} -14 ${N1(w)} 0" stroke="#fff" stroke-width="4" fill="none" opacity=".6"/>`;
	}
	return "";
}
function ears(f: Face, g: Geo, sk: string): string
{
	const line = FACE_LINE[f.skin]!;
	const {w, ey} = g;
	const y = ey + 10;
	const EB = [
		[5, 14],
		[9, 21],
		[8, 14],
		[14, 9],
	];
	let o = "";
	for (const s of [-1, 1])
	{
		const x = 100 + s * (w - 3);
		switch (f.ears)
		{
			case 0:
				o += `<ellipse cx="${x + s * 5}" cy="${y}" rx="10" ry="14"/><path fill="none" stroke="${line}" stroke-width="2" d="M${x + s * 7} ${y - 6} q${-s * 5} 6 0 12"/>`;
				break;
			case 1:
				o += `<ellipse cx="${x + s * 9}" cy="${y}" rx="15" ry="21"/><path fill="none" stroke="${line}" stroke-width="2" d="M${x + s * 12} ${y - 10} q${-s * 8} 10 0 20"/>`;
				break;
			case 2:
				o += `<path d="M${x} ${y - 10} Q${x + s * 14} ${y - 18} ${x + s * 24} ${y - 30} Q${x + s * 18} ${y - 4} ${x + s * 8} ${y + 14} Q${x + s * 2} ${y + 16} ${x} ${y + 10}Z"/>`;
				break;
			case 3:
				o += `<ellipse cx="${x + s * 14}" cy="${y}" rx="16" ry="11" transform="rotate(${-s * 25} ${x + s * 14} ${y})"/>`;
				break;
		}
		if (f.earrings)
		{
			const [dx, dy] = EB[f.ears] as [number, number];
			const ex = x + s * dx,
				ey2 = y + dy;
			o += [
				`<circle cx="${ex}" cy="${ey2 + 7}" r="7.5" fill="none" stroke="#d4a017" stroke-width="3.6"/>`,
				`<path d="M${ex} ${ey2 - 1} v4" fill="none" stroke-width="2"/><path d="M${ex} ${ey2 + 2} q-10 13 0 17 q10 -4 0 -17Z" fill="#35c4f0" stroke-width="1.8"/>`,
				`<circle cx="${ex}" cy="${ey2 + 6}" r="7.5" fill="#e5484d" stroke-width="1.8"/>`,
				`<path d="M${ex} ${ey2 - 1} l-8.5 19 h17Z" fill="#3fbf6f" stroke-width="1.8"/>`,
			][f.earrings - 1]!;
		}
	}
	return `<g fill="${sk}">${o}</g>`;
}
function eye(st: number, x: number, y: number, ic: string, s: number, sk: string, line: string): string
{
	const base = (r: number, ir: number, pr: number, dx = 0): string =>
		`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + dx}" cy="${y + 1}" r="${ir}" fill="${ic}" stroke-width="1.8"/><circle cx="${x + dx}" cy="${y + 1}" r="${pr}" fill="#111" stroke="none"/><circle cx="${N1(x + dx - ir * 0.38)}" cy="${N1(y - ir * 0.3)}" r="${N1(Math.max(1.3, ir * 0.26))}" fill="#fff" stroke="none"/>`;
	switch (st)
	{
		case 0:
			return base(10, 6.8, 3);
		case 1:
			return base(14, 9.5, 4.2);
		case 2:
			return base(11, 7, 3) + `<path d="M${x - 11.8} ${y - 2} A12 12 0 0 1 ${x + 11.8} ${y - 2}Z" fill="${sk}"/>`;
		case 3:
			return `<path d="M${x - 15} ${y} Q${x} ${y - 12} ${x + 15} ${y} Q${x} ${y + 12} ${x - 15} ${y}Z" fill="#fff"/><circle cx="${x}" cy="${y}" r="6.3" fill="${ic}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="2.8" fill="#111" stroke="none"/><circle cx="${x - 2}" cy="${y - 2}" r="1.4" fill="#fff" stroke="none"/>`;
		case 4:
			return (
				base(10, 6.8, 3) +
				`<path fill="none" stroke-width="4" d="M${x - 10} ${y - 2} A10.2 10.2 0 0 1 ${x + 10} ${y - 2}"/><path fill="none" stroke="${line}" stroke-width="3" d="M${x + s * 4} ${y - 10} l${s * 4} -6 M${x + s * 8} ${y - 7} l${s * 8} -4 M${x + s * 10} ${y - 2} l${s * 9} 0 M${x - s * 2} ${y - 11} l0 -6"/>`
			);
		case 5:
			return base(11, 7, 3, 4);
	}
	return "";
}
function eyes(f: Face, g: Geo): string
{
	let o = "";
	for (const s of [-1, 1])
		o += eye(f.eyes, Number(N1(100 + s * g.ex)), g.ey, EYEC[f.eyeColor]!, s, SKIN[f.skin]!, FACE_LINE[f.skin]!);
	return o;
}
function brows(f: Face, g: Geo, hc: string): string
{
	const {ey, ex} = g;
	// Glasses push the eyebrows up, so no frame ever sits on top of them.
	const y = Number(N1(ey - (f.eyes === 1 ? 22 : 18) - (f.glasses ? 7 : 0)));
	const one = (s: number): string =>
	{
		const x = 100 + s * ex,
			xo = N1(x + s * 12),
			xi = N1(x - s * 11),
			xm = N1(x);
		switch (f.eyebrows)
		{
			case 0:
				return `M${xi} ${y + 1} Q${xm} ${y - 6} ${xo} ${y + 2}`;
			case 1:
				return `M${xi} ${y - 1} L${xo} ${y - 1}`;
			case 2:
				return `M${xo} ${y - 4} L${xi} ${y + 4}`;
			case 3:
				return `M${xo} ${y + 3} L${xi} ${y - 5}`;
			case 5:
				return s < 0 ? `M${xi} ${y - 5} Q${xm} ${y - 17} ${xo} ${y - 4}` : `M${xi} ${y + 3} L${xo} ${y + 1}`;
		}
		return "";
	};
	const d =
		f.eyebrows === 4
			? `M${N1(100 - ex - 13)} ${y + 1} Q${N1(100 - ex)} ${y - 6} 100 ${y} Q${N1(100 + ex)} ${y - 6} ${N1(100 + ex + 13)} ${y + 1}`
			: one(-1) + " " + one(1);
	const sw = f.eyebrows === 1 ? 10.5 : f.eyebrows === 4 ? 7 : 5.5;
	return `<path d="${d}" fill="none" stroke-width="${sw + 3}"/><path d="${d}" fill="none" stroke="${hc}" stroke-width="${sw}"/>`;
}
function nose(f: Face, g: Geo, sk: string): string
{
	const y = Number(N1(g.ny));
	switch (f.nose)
	{
		case 0:
			return `<path fill="none" d="M95 ${y - 1} Q100 ${y + 7} 105 ${y - 1}"/>`;
		case 1:
			return `<path fill="none" d="M101 ${y - 16} L94 ${y + 4} L104 ${y + 4}"/>`;
		case 2:
			return `<path fill="none" d="M100 ${y - 20} Q103 ${y - 2} 97 ${y + 5} Q101 ${y + 9} 106 ${y + 4}"/>`;
		case 3:
			return `<circle cx="100" cy="${y}" r="10" fill="${shade(sk, -0.15)}"/>`;
		case 4:
			// On the darkest skins a darker fill disappears, so the bulb is lighter there.
			return `<path fill="${shade(sk, f.skin >= 3 ? 0.22 : -0.06)}" d="M97 ${y - 18} Q115 ${y - 2} 106 ${y + 6} Q100 ${y + 8} 95 ${y + 4}"/>`;
		case 5:
			return `<path fill="none" d="M87 ${y + 2} Q90 ${y - 7} 95 ${y + 1} Q100 ${y + 6} 105 ${y + 1} Q110 ${y - 7} 113 ${y + 2}"/>`;
		case 6:
			return `<ellipse cx="100" cy="${y}" rx="11" ry="8" fill="#f7a1b0"/><ellipse cx="96" cy="${y}" rx="2" ry="3" fill="#5a2a30" stroke="none"/><ellipse cx="104" cy="${y}" rx="2" ry="3" fill="#5a2a30" stroke="none"/>`;
	}
	return "";
}
function mouth(f: Face, g: Geo): string
{
	const y = Number(N1(g.my));
	switch (f.mouth)
	{
		case 0:
			return `<path fill="none" d="M86 ${y} Q100 ${y + 13} 114 ${y}"/>`;
		case 1:
			return `<path fill="#fff" stroke="${INK}" d="M84 ${y - 2} L116 ${y - 2} Q114 ${y + 18} 100 ${y + 18} Q86 ${y + 18} 84 ${y - 2}Z"/><path fill="none" stroke="${INK}" stroke-width="2" d="M85 ${y + 5} L115 ${y + 5} M93 ${y - 2} L93 ${y + 16} M100 ${y - 2} L100 ${y + 18} M107 ${y - 2} L107 ${y + 16}"/>`;
		case 2:
			return `<path fill="none" d="M87 ${y + 9} Q100 ${y - 4} 113 ${y + 9}"/>`;
		case 3:
			return `<ellipse cx="100" cy="${y + 5}" rx="8" ry="10" fill="#7a2228"/>`;
		case 4:
			return `<path fill="none" d="M88 ${y + 4} L112 ${y + 4}"/>`;
		case 5:
			return `<path fill="#ff7a8a" d="M95 ${y + 5} Q95 ${y + 20} 101 ${y + 20} Q107 ${y + 20} 107 ${y + 5}Z"/><path fill="none" d="M86 ${y} Q100 ${y + 12} 114 ${y}"/>`;
		case 6:
			return `<path fill="none" d="M87 ${y + 5} Q104 ${y + 7} 114 ${y - 4}"/>`;
		case 7:
			return `<path fill="none" d="M86 ${y} Q100 ${y + 9} 114 ${y}"/><path fill="#fff" stroke="${INK}" stroke-width="2" d="M95 ${y + 4} h10 v9 h-10Z M100 ${y + 4} v9"/>`;
		case 8:
			// Puckered lips, with a crease at each side.
			return `<path fill="#e0455a" d="M90 ${y + 4} Q95 ${y - 5} 100 ${y + 1} Q105 ${y - 5} 110 ${y + 4} Q107 ${y + 16} 100 ${y + 16} Q93 ${y + 16} 90 ${y + 4}Z"/><path fill="none" stroke-width="2" d="M90 ${y + 4} Q100 ${y + 9} 110 ${y + 4} M85 ${y + 1} l-5 -3 M85 ${y + 8} l-5 3 M115 ${y + 1} l5 -3 M115 ${y + 8} l5 3"/>`;
	}
	return "";
}
function beardBack(f: Face, g: Geo, hc: string, sk: string): string
{
	const {L, R, b, ey, ny, my, w} = g;
	// The full beard starts below the cheeks and leaves an opening, so cheeks and mouth show on any hair color.
	if (f.facialHair === 3)
		return `<path fill="${hc}" d="M${L + 3} ${N1(ny + 18)} Q${L + 2} ${b + 2} 100 ${b + 10} Q${R - 2} ${b + 2} ${R - 3} ${N1(ny + 18)} Q${R - 12} ${N1(ny + 22)} 122 ${N1(my - 6)} Q100 ${N1(my - 14)} 78 ${N1(my - 6)} Q${L + 12} ${N1(ny + 22)} ${L + 3} ${N1(ny + 18)}Z"/><ellipse fill="${sk}" cx="100" cy="${N1(my + 8)}" rx="21" ry="14"/>`;
	if (f.facialHair === 4)
	{
		const y = Number(N1(my));
		return `<path fill="${hc}" d="M90 ${y + 11} Q100 ${y + 7} 110 ${y + 11} L105 ${y + 28} Q100 ${y + 32} 95 ${y + 28}Z"/>`;
	}
	if (f.facialHair === 6)
	{
		// Sideburns start under the hair, so they join it, and run to the jaw short of the cheeks.
		const side = (x: number, s: number): string =>
			`M${x - s * 3} ${N1(ey - 18)} L${x + s * 15} ${N1(ey - 18)} L${x + s * 17} ${N1(ny + 14)} Q${x + s * 11} ${N1(ny + 27)} ${x + s * 4} ${N1(ny + 20)}Z`;
		return `<path fill="${hc}" d="${side(L, 1)} ${side(R, -1)}"/>`;
	}
	if (f.facialHair === 7)
	{
		// A goatee circles the mouth: mustache, chin and the strips that join them.
		const y = Number(N1(my)),
			low = Math.min(y + 34, b + 5);
		return `<path fill="${hc}" d="M79 ${y - 8} Q100 ${y - 19} 121 ${y - 8} L122 ${y + 17} Q100 ${low + 4} 78 ${y + 17}Z"/><ellipse fill="${sk}" cx="100" cy="${y + 6}" rx="15" ry="10"/>`;
	}
	if (f.facialHair === 8)
	{
		// Mutton chops: sideburns that run under the cheeks and meet in a mustache, with the chin bare.
		const y = Number(N1(my)),
			n = Number(N1(ny));
		const chop = (x: number, s: number): string =>
			`M${x - s * 3} ${N1(ey - 18)} L${x + s * 13} ${N1(ey - 18)} L${x + s * 13} ${n + 18} Q${x + s * 16} ${n + 27} ${x + s * 30} ${n + 26} L${100 - s * 13} ${y - 9} Q${100 - s * 6} ${y - 13} 100 ${y - 8} L100 ${y - 3} Q${100 - s * 16} ${y - 1} ${x + s * 30} ${y + 11} Q${x + s * 10} ${y + 12} ${x + s * 3} ${n + 16}Z`;
		return `<path fill="${hc}" d="${chop(L, 1)} ${chop(R, -1)}"/>`;
	}
	if (f.facialHair === 9)
	{
		// A chin strap: one thin line of beard along the jaw, ear to ear.
		const d = `M${L + 3} ${N1(ny + 4)} Q${L + 5} ${b - 7} 100 ${b - 3} Q${R - 5} ${b - 7} ${R - 3} ${N1(ny + 4)}`;
		return `<path d="${d}" fill="none" stroke-width="11"/><path d="${d}" fill="none" stroke="${hc}" stroke-width="7.5"/>`;
	}
	if (f.facialHair === 10)
	{
		// A long chin beard that hangs to a point below the chin.
		const y = Number(N1(my));
		return `<path fill="${hc}" d="M81 ${y + 9} Q100 ${y + 15} 119 ${y + 9} L113 ${b + 2} L100 ${b + 26} L87 ${b + 2}Z"/>`;
	}
	if (f.facialHair === 5)
	{
		let s = "";
		for (const [u, v] of STUB)
		{
			s += `<circle cx="${N1(100 + u * w * 0.75)}" cy="${N1(my - 6 + v * (b - my + 2))}" r="1.4"/>`;
		}
		return `<g fill="${darkSkin(f) ? shade(hc, 0.5) : shade(hc, -0.4)}" stroke="none">${s}</g>`;
	}
	return "";
}
function mustache(f: Face, g: Geo, hc: string): string
{
	const y = Number(N1(g.my));
	if (f.facialHair === 1)
		return `<path fill="${hc}" d="M83 ${y - 3} Q90 ${y - 14} 100 ${y - 7} Q110 ${y - 14} 117 ${y - 3} Q108 ${y - 3} 100 ${y - 4} Q92 ${y - 3} 83 ${y - 3}Z"/>`;
	if (f.facialHair === 2)
	{
		// A handlebar: wide, with both ends curled up.
		const d = `M100 ${y - 7} Q88 ${y - 15} 78 ${y - 3} Q72 ${y + 6} 66 ${y - 3} M100 ${y - 7} Q112 ${y - 15} 122 ${y - 3} Q128 ${y + 6} 134 ${y - 3}`;
		return `<path d="${d}" fill="none" stroke-width="11.5"/><path d="${d}" fill="none" stroke="${hc}" stroke-width="8"/>`;
	}
	return "";
}
function cheeks(f: Face, g: Geo, sk: string): string
{
	const {w, ny} = g;
	const cy = Number(N1(ny + 8)),
		lx = Number(N1(100 - w * 0.52)),
		rx = Number(N1(100 + w * 0.52));
	switch (f.cheeks)
	{
		case 1:
			return `<g fill="#ff8fa3" opacity=".6" stroke="none"><ellipse cx="${lx}" cy="${cy}" rx="12" ry="8"/><ellipse cx="${rx}" cy="${cy}" rx="12" ry="8"/></g>`;
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
					s += `<circle cx="${x + a}" cy="${cy + c}" r="2.2"/>`;
			}
			return `<g fill="${darkSkin(f) ? shade(sk, 0.5) : shade(sk, -0.5)}" stroke="none">${s}</g>`;
		}
		case 3:
		{
			// Two stripes of face paint on each cheek.
			const stripes = (x: number, s: number): string =>
				`M${x - s * 10} ${cy - 3} l${s * 19} -5 M${x - s * 10} ${cy + 6} l${s * 19} -5`;
			return `<path fill="none" stroke="#3a78f2" stroke-width="5" d="${stripes(lx, -1)} ${stripes(rx, 1)}"/>`;
		}
		case 4:
			return `<g transform="rotate(-25 ${lx} ${cy})"><rect x="${lx - 12}" y="${cy - 5}" width="24" height="10" rx="4" fill="#f3c999" stroke="${INK}" stroke-width="2"/><rect x="${lx - 4}" y="${cy - 4}" width="8" height="8" fill="#e2a96f" stroke="none"/></g>`;
		case 5:
			return `<path d="${star(rx, cy, 12, 5.4)}" fill="#ffd23f" stroke="${INK}" stroke-width="2"/>`;
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
			return `<path fill="none" stroke="${shade(c, -0.45)}" stroke-width="4" d="M20 237 H180 M16 247 H184"/>`;
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
				s += `<circle cx="${x}" cy="${y}" r="3.6"/>`;
			return `<g fill="#fff" stroke-width="1.5">${s}</g>`;
		}
		case 3:
			return `<g fill="${shade(c, -0.35)}"><path d="M12 254 Q16 226 60 219 L46 254Z"/><path d="M188 254 Q184 226 140 219 L154 254Z"/></g>`;
		case 4:
			return `<g fill="#3b3b45"><path d="M65 222 L60 254 L72 254 L76 226Z"/><path d="M135 222 L140 254 L128 254 L124 226Z"/></g>`;
		case 5:
		{
			const d =
				"M16 247 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10 l14 -10 l14 10";
			return `<path fill="none" stroke-width="8.5" d="${d}"/><path fill="none" stroke="#fff" stroke-width="5" d="${d}"/>`;
		}
	}
	return "";
}
function neckwear(f: Face): string
{
	switch (f.neckwear)
	{
		case 1:
			return `<path fill="#2c3e50" d="M100 225 L83 216 L83 234Z M100 225 L117 216 L117 234Z"/><circle cx="100" cy="225" r="4.5" fill="#2c3e50"/>`;
		case 2:
		{
			let s = "";
			for (let i = 0; i < 9; i++)
			{
				const a = Math.PI * (0.15 + (0.7 * i) / 8);
				s += `<circle cx="${N1(100 - Math.cos(a) * 24)}" cy="${N1(214 + Math.sin(a) * 16)}" r="3.7"/>`;
			}
			return `<g fill="#fffaf0" stroke-width="1.5">${s}</g>`;
		}
		case 3:
			return `<path fill="#f39c12" d="M82 228 L74 253 L93 253 L95 231Z"/><path fill="none" stroke-width="2" d="M79 253 v-8 M84 253 v-8 M89 253 v-8"/><path fill="#f39c12" d="M77 206 Q100 217 123 206 L126 224 Q100 237 74 224Z"/><path fill="none" stroke="#c0392b" stroke-width="3" d="M88 211 l-2 17 M100 213 v19 M112 211 l2 17"/>`;
		case 4:
			return `<path fill="#fff" d="M100 223 L83 213 L79 229 L93 233Z M100 223 L117 213 L121 229 L107 233Z"/><path fill="#8e44ad" d="M96 232 L104 232 L111 254 L89 254Z"/><path fill="#8e44ad" d="M93 221 L107 221 L104 232 L96 232Z"/>`;
		case 5:
			return `<path fill="none" stroke-width="5.5" d="M83 213 Q90 232 100 238 Q110 232 117 213"/><path fill="none" stroke="#e6b422" stroke-width="2.6" d="M83 213 Q90 232 100 238 Q110 232 117 213"/><path fill="#e5484d" d="M100 235 l7 8 l-7 9 l-7 -9Z"/>`;
		case 6:
			return `<path fill="#2f6fde" d="M74 209 Q100 222 126 209 L100 251Z"/><g fill="#fff" stroke="none"><circle cx="90" cy="221" r="2.4"/><circle cx="110" cy="221" r="2.4"/><circle cx="100" cy="228" r="2.4"/><circle cx="100" cy="240" r="2.4"/></g>`;
	}
	return "";
}
function glasses(f: Face, g: Geo): string
{
	const {ey, ex, w} = g;
	const y = Number(N1(ey)),
		lx = Number(N1(100 - ex)),
		rx = Number(N1(100 + ex)),
		L = 100 - w,
		R = 100 + w;
	const arms = (d: number): string =>
		`<path fill="none" d="M${lx + d} ${y - 2} Q100 ${y - 8} ${rx - d} ${y - 2} M${lx - d} ${y - 2} L${L - 1} ${y - 6} M${rx + d} ${y - 2} L${R + 1} ${y - 6}"/>`;
	switch (f.glasses)
	{
		case 1:
			return (
				`<g fill="none"><circle cx="${lx}" cy="${y}" r="18"/><circle cx="${rx}" cy="${y}" r="18"/></g>` +
				arms(18)
			);
		case 2:
			return (
				`<g fill="none"><rect x="${lx - 19}" y="${y - 17}" width="38" height="34" rx="5"/><rect x="${rx - 19}" y="${y - 17}" width="38" height="34" rx="5"/></g>` +
				arms(19)
			);
		case 3:
		{
			// Aviators: thin gold teardrop frames with a top bar, and clear lenses like every other pair.
			const lens = (x: number, s: number): string =>
				`M${x - s * 17} ${y - 18} L${x + s * 19} ${y - 19} Q${x + s * 26} ${y + 8} ${x + s * 5} ${y + 22} Q${x - s * 18} ${y + 23} ${x - s * 17} ${y - 18}Z`;
			const d = `${lens(lx, -1)} ${lens(rx, 1)} M${lx + 17} ${y - 17} L${rx - 17} ${y - 17}`;
			return (
				`<path fill="none" stroke-width="6" d="${d}"/><path fill="none" stroke="#e6b422" stroke-width="2.6" d="${d}"/>` +
				arms(18)
			);
		}
		case 4:
			return `<circle cx="${rx}" cy="${y}" r="18" fill="none" stroke="#c9a227" stroke-width="4"/><path fill="none" stroke="#c9a227" stroke-width="2" stroke-dasharray="3 3" d="M${rx + 13} ${y + 13} Q${rx + 22} ${y + 40} ${rx + 8} ${y + 62}"/>`;
		case 5:
		{
			// Cat-eye frames: the outer corners sweep up, and the lens stays wider than the largest eye.
			const lens = (x: number, s: number): string =>
				`M${x - s * 18} ${y - 12} Q${x} ${y - 21} ${x + s * 27} ${y - 24} Q${x + s * 23} ${y + 14} ${x + s * 3} ${y + 19} Q${x - s * 18} ${y + 18} ${x - s * 18} ${y - 12}Z`;
			return `<path fill="none" stroke="#ff4fa0" stroke-width="4.5" d="${lens(lx, -1)} ${lens(rx, 1)} M${lx + 18} ${y - 4} Q100 ${y - 9} ${rx - 18} ${y - 4}"/>`;
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
function hat(f: Face, g: Geo): string
{
	if (!f.hat) return "";
	const {w, t, ey} = g;
	const afro = f.hairStyle === 4;
	const lift = LIFT[f.hairStyle] ?? 0;
	const hy = afro ? t + 34 - (w + 20) + 30 : t + 16 - lift;
	const hw = w + (afro ? 22 : 5);
	const c = HATC[f.hatColor]!;
	const dome = (h: number): string =>
		`M${100 - hw} ${hy} Q${100 - hw} ${hy - h} 100 ${hy - h - 2} Q${100 + hw} ${hy - h} ${100 + hw} ${hy}Z`;
	switch (f.hat)
	{
		case 1:
			return `<path fill="${c}" d="${dome(48)}"/><path fill="#fff" d="M${N1(100 - hw * 0.5)} ${hy} Q${N1(100 - hw * 0.5)} ${hy - 44} 100 ${hy - 50} Q${N1(100 + hw * 0.5)} ${hy - 44} ${N1(100 + hw * 0.5)} ${hy}Z"/><circle fill="${c}" cx="100" cy="${hy - 50}" r="4.5"/><path fill="${shade(c, -0.2)}" d="M${100 - hw + 2} ${hy - 2} Q100 ${hy - 10} ${100 + hw - 2} ${hy - 2} Q${100 + hw + 6} ${hy + 13} 100 ${hy + 15} Q${100 - hw - 6} ${hy + 13} ${100 - hw + 2} ${hy - 2}Z"/>`;
		case 2:
			return `<path fill="${c}" d="${dome(52)}"/><rect fill="${shade(c, -0.15)}" x="${100 - hw - 3}" y="${hy - 13}" width="${2 * hw + 6}" height="17" rx="6"/><circle fill="#fff" cx="100" cy="${hy - 58}" r="10"/>`;
		case 3:
			return `<rect fill="#2d2d2d" x="${N1(100 - hw * 0.72)}" y="${hy - 60}" width="${N1(hw * 1.44)}" height="60"/><rect fill="${c}" x="${N1(100 - hw * 0.72)}" y="${hy - 20}" width="${N1(hw * 1.44)}" height="12"/><ellipse fill="#2d2d2d" cx="100" cy="${hy}" rx="${hw + 14}" ry="8"/>`;
		case 4:
			return `<path fill="#f5c542" d="M${N1(100 - hw * 0.8)} ${hy + 2} L${N1(100 - hw * 0.86)} ${hy - 36} L${N1(100 - hw * 0.45)} ${hy - 16} L100 ${hy - 44} L${N1(100 + hw * 0.45)} ${hy - 16} L${N1(100 + hw * 0.86)} ${hy - 36} L${N1(100 + hw * 0.8)} ${hy + 2}Z"/><circle cx="100" cy="${hy - 10}" r="5" fill="#e74c3c" stroke-width="2"/><circle cx="${N1(100 - hw * 0.45)}" cy="${hy - 6}" r="4" fill="#3498db" stroke-width="2"/><circle cx="${N1(100 + hw * 0.45)}" cy="${hy - 6}" r="4" fill="#3498db" stroke-width="2"/>`;
		case 5:
		{
			const band = `M${100 - w - 2} ${N1(ey - 4)} C${100 - w - 6} ${t - 24} ${100 + w + 6} ${t - 24} ${100 + w + 2} ${N1(ey - 4)}`;
			const bx = Number(N1(100 - w * 0.5)),
				by = t + 4 - (afro ? 20 : lift);
			return `<path d="${band}" fill="none" stroke-width="10"/><path d="${band}" fill="none" stroke="${c}" stroke-width="6"/><path fill="${c}" d="M${bx} ${by} L${bx - 20} ${by - 14} L${bx - 20} ${by + 14}Z M${bx} ${by} L${bx + 20} ${by - 14} L${bx + 20} ${by + 14}Z"/><circle fill="${c}" cx="${bx}" cy="${by}" r="6"/>`;
		}
		case 6:
			return `<path fill="${c}" d="M74 ${hy} L106 ${hy - 66} L130 ${hy + 2}Z"/><g fill="#fff" stroke="none"><circle cx="96" cy="${hy - 14}" r="3.5"/><circle cx="110" cy="${hy - 30}" r="3.5"/><circle cx="104" cy="${hy - 48}" r="3"/><circle cx="116" cy="${hy - 10}" r="3.5"/><circle cx="86" cy="${hy - 4}" r="3"/></g><circle fill="#fff" cx="106" cy="${hy - 68}" r="7"/>`;
		case 7:
			return `<path fill="${c}" d="${dome(50)}"/><path fill="#f1c40f" d="M92 ${hy} Q93 ${hy - 40} 100 ${hy - 52} Q107 ${hy - 40} 108 ${hy}Z"/><path d="M100 ${hy - 52} L100 ${hy - 64}" fill="none"/><ellipse fill="#f1c40f" cx="88" cy="${hy - 66}" rx="12" ry="4.5"/><ellipse fill="#f1c40f" cx="112" cy="${hy - 66}" rx="12" ry="4.5"/><circle fill="${c}" cx="100" cy="${hy - 66}" r="3.5"/>`;
		case 8:
			return `<ellipse fill="#9a7650" cx="100" cy="${hy}" rx="${hw + 20}" ry="8"/><path fill="#9a7650" d="M${N1(100 - hw * 0.78)} ${hy} Q${N1(100 - hw * 0.86)} ${hy - 42} ${N1(100 - hw * 0.38)} ${hy - 48} Q100 ${hy - 36} ${N1(100 + hw * 0.38)} ${hy - 48} Q${N1(100 + hw * 0.86)} ${hy - 42} ${N1(100 + hw * 0.78)} ${hy}Z"/><path fill="${c}" d="M${N1(100 - hw * 0.8)} ${hy - 15} L${N1(100 + hw * 0.8)} ${hy - 15} L${N1(100 + hw * 0.78)} ${hy - 3} L${N1(100 - hw * 0.78)} ${hy - 3}Z"/>`;
		case 9:
			return `<path fill="${c}" d="M${100 - hw - 10} ${hy - 8} Q${100 - hw - 6} ${hy - 48} 104 ${hy - 45} Q${100 + hw + 24} ${hy - 42} ${100 + hw + 13} ${hy - 6} Q100 ${hy + 4} ${100 - hw - 10} ${hy - 8}Z"/><path fill="${shade(c, -0.2)}" d="M${100 - hw + 2} ${hy - 6} Q100 ${hy + 6} ${100 + hw - 2} ${hy - 4} L${100 + hw - 2} ${hy + 3} Q100 ${hy + 13} ${100 - hw + 2} ${hy + 1}Z"/><path fill="none" d="M105 ${hy - 45} l4 -11"/>`;
		case 10:
		case 11:
		{
			const band = `M${100 - w - 2} ${N1(ey - 4)} C${100 - w - 6} ${t - 24} ${100 + w + 6} ${t - 24} ${100 + w + 2} ${N1(ey - 4)}`;
			const by = t + 6 - (afro ? 20 : lift);
			const cat = f.hat === 10,
				col = cat ? "#2b2b2b" : "#d92b2b";
			const ear = (s: number): string =>
			{
				const x = Number(N1(100 + s * w * 0.55));
				return cat
					? `<path fill="${col}" d="M${x - 21} ${by + 6} L${x + s * 6} ${by - 44} L${x + 21} ${by + 6}Z"/><path fill="#ffb3c7" stroke="none" d="M${x - 10} ${by + 1} L${x + s * 5} ${by - 27} L${x + 11} ${by + 1}Z"/>`
					: `<path fill="${col}" d="M${x - 10} ${by + 5} Q${x - s * 6} ${by - 22} ${x + s * 20} ${by - 38} Q${x + s * 16} ${by - 8} ${x + 10} ${by + 5}Z"/>`;
			};
			return `${ear(-1)}${ear(1)}<path d="${band}" fill="none" stroke-width="10"/><path d="${band}" fill="none" stroke="${col}" stroke-width="6"/>`;
		}
	}
	return "";
}
function regions(f: Face, k: FeatureKey): Region[]
{
	const {w, t, b, ey, ny, my, L, R} = geo(f);
	switch (k)
	{
		case "hat":
		case "hatColor":
			return [[100, t - 14, w + 26, 42]];
		case "hairStyle":
		case "hairDye":
			return [[100, t + 26, w + 28, 56]];
		case "hairColor":
			return [
				[100, t + 26, w + 28, 56],
				[100, ey - 19, w * 0.8, 13],
			];
		case "eyes":
		case "eyeColor":
		case "glasses":
			return [[100, ey, w * 0.85, 22]];
		case "eyebrows":
			return [[100, ey - (f.glasses ? 26 : 19), w * 0.8, 13]];
		case "nose":
			return [[100, ny, 20, 20]];
		case "mouth":
			return [[100, my + 5, 28, 17]];
		case "facialHair":
			if (f.facialHair === 6 || f.facialHair === 8) return [[100, (ey + b) / 2, w + 8, (b - ey) / 2 + 12]];
			return f.facialHair === 10 ? [[100, my + 18, w * 0.85, 44]] : [[100, my + 6, w * 0.85, 32]];
		case "ears":
		case "earrings":
			return [
				[L - 4, ey + 16, 19, 28],
				[R + 4, ey + 16, 19, 28],
			];
		case "cheeks":
			return [
				[100 - w * 0.52, ny + 8, 18, 17],
				[100 + w * 0.52, ny + 8, 18, 17],
			];
		case "neckwear":
			return [[100, 230, 36, 20]];
		case "shirt":
		case "shirtStyle":
			return [[100, 240, 86, 16]];
		case "faceShape":
		case "skin":
			return [[100, (t + b) / 2, w + 12, (b - t) / 2 + 12]];
	}
	return [];
}
const VB = [-12, -44, 224, 298];
const CROPPED = new Set<FeatureKey>([
	"eyes",
	"eyeColor",
	"eyebrows",
	"nose",
	"mouth",
	"cheeks",
	"ears",
	"earrings",
	"facialHair",
	"glasses",
	"neckwear",
]);
export function cropBox(f: Face, k: FeatureKey): string | null
{
	return CROPPED.has(k) ? featureBox(f, [k]) : null;
}
// A square viewBox around every region the features occupy, or only the first of each mirrored pair when oneSide is set.
export function featureBox(f: Face, keys: readonly FeatureKey[], oneSide = false): string
{
	const rs = keys.flatMap((k) => (oneSide ? regions(f, k).slice(0, 1) : regions(f, k)));
	let x0 = 1e9,
		y0 = 1e9,
		x1 = -1e9,
		y1 = -1e9;
	for (const [cx, cy, rx, ry] of rs)
	{
		x0 = Math.min(x0, cx - rx);
		x1 = Math.max(x1, cx + rx);
		y0 = Math.min(y0, cy - ry);
		y1 = Math.max(y1, cy + ry);
	}
	const s = Math.max(x1 - x0, y1 - y0) + 16,
		cx = (x0 + x1) / 2,
		cy = (y0 + y1) / 2;
	return `${N1(cx - s / 2)} ${N1(cy - s / 2)} ${N1(s)} ${N1(s)}`;
}

export interface FaceOptions
{
	hl?: FeatureKey[] | null | undefined;
	good?: boolean;
	mark?: [number, number] | undefined;
	vb?: string | null;
}

// Where the chin crosses the neck there is skin on both sides of the outline, so on the darkest skins that stretch is
// redrawn in the face line.
function jawLine(f: Face, g: Geo): string
{
	if (!darkSkin(f)) return "";
	return `<clipPath id="jaw"><rect x="87.5" y="150" width="25" height="80"/></clipPath><g clip-path="url(#jaw)" fill="none" stroke="${FACE_LINE[f.skin]}">${headShape(f, g)}</g>`;
}

export function faceSVG(f: Face, o: FaceOptions = {}): string
{
	const g = geo(f),
		sk = SKIN[f.skin]!,
		hc = HAIRC[f.hairColor]!,
		// Dye colors the hair on the head; eyebrows and facial hair keep the natural color.
		dye = f.hairDye ? DYEC[f.hairDye]! : hc;
	const onFace = (inner: string): string => (darkSkin(f) ? `<g stroke="${FACE_LINE[f.skin]}">${inner}</g>` : inner);
	let s = hairBack(f, g, dye);
	s += `<path d="M86 ${g.b - 16} L86 228 L114 228 L114 ${g.b - 16}Z" fill="${sk}"/>`;
	s += `<path d="M12 254 Q16 226 60 219 Q80 230 100 230 Q120 230 140 219 Q184 226 188 254Z" fill="${CLOTH[f.shirt]}"/>`;
	s += shirtPattern(f);
	s +=
		neckwear(f) +
		ears(f, g, sk) +
		`<g fill="${sk}">${headShape(f, g)}</g>` +
		jawLine(f, g) +
		onFace(cheeks(f, g, sk) + beardBack(f, g, hc, sk)) +
		hairFront(f, g, dye) +
		eyes(f, g) +
		onFace(brows(f, g, hc) + nose(f, g, sk) + mouth(f, g) + mustache(f, g, hc) + glasses(f, g)) +
		hat(f, g);
	let hl = "";
	if (o.hl)
	{
		for (const k of o.hl)
		{
			for (const [cx, cy, rx, ry] of regions(f, k))
				hl += `<ellipse class="hl${o.good ? " good" : ""}" cx="${N1(cx)}" cy="${N1(cy)}" rx="${N1(rx)}" ry="${N1(ry)}"/>`;
		}
	}
	const mk = o.mark
		? `<g class="xmark"><path d="M${N1(o.mark[0] - 8)} ${N1(o.mark[1] - 8)} l16 16 M${N1(o.mark[0] + 8)} ${N1(o.mark[1] - 8)} l-16 16"/></g>`
		: "";
	return `<svg viewBox="${o.vb ?? VB.join(" ")}" preserveAspectRatio="xMidYMid meet" class="face" xmlns="http://www.w3.org/2000/svg"><g filter="url(#wob)" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${s}</g>${hl}${mk}</svg>`;
}

export const FACE_ASPECT = VB[3]! / VB[2]!;
