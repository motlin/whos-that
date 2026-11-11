import type {Face, FeatureKey} from "./faces.ts";

// What every art style shares: where the features sit on the card, so crops, highlights and tap marks line up whatever
// style drew the face.
export const INK = "#2a2522";
// The hat value that is a pair of headphones rather than something worn on the crown.
const HEADPHONES = 2;
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
export interface Geo
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

export function geo(f: Face): Geo
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
// Where a curve that rises with s on 0..1 reaches the target.
export function solve(curve: (s: number) => number, target: number): number
{
	let lo = 0,
		hi = 1;
	for (let i = 0; i < 16; i++)
	{
		const s = (lo + hi) / 2;
		if (curve(s) < target) lo = s;
		else hi = s;
	}
	return (lo + hi) / 2;
}

// Half the width of the head at a height, or -1 above and below it. The shapes are the ones every style draws.
export function headHalf(f: Face, g: Geo, Y: number): number
{
	const {w, t, b, cy, ry} = g;
	if (Y < t || Y > b) return -1;
	if (f.faceShape === 2)
	{
		const d = Math.max(t + 28 - Y, Y - (b - 28), 0);
		return w - 28 + Math.sqrt(28 * 28 - d * d);
	}
	if (f.faceShape === 4)
	{
		if (Y <= t + 50)
		{
			const s = 1 - Math.sqrt((Y - t) / 50);
			return w * (1 - s * s);
		}
		const s = solve((v) => (t + 50) * (1 - v) ** 2 + 2 * (b - 40) * v * (1 - v) + b * v * v, Y);
		return w * (1 - s) ** 2 + 2 * (w - 4) * s * (1 - s);
	}
	return w * Math.sqrt(1 - ((Y - cy) / ry) ** 2);
}

export function shade(hex: string, p: number): string
{
	const n = parseInt(hex.slice(1), 16);
	const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
		Math.max(0, Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p))),
	);
	return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
export function star(cx: number, cy: number, R: number, r: number, n = 5): string
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
export const N1 = (v: number): string => v.toFixed(1);
export function regions(f: Face, k: FeatureKey): Region[]
{
	const {w, t, b, ey, ny, my, L, R} = geo(f);
	switch (k)
	{
		case "hat":
		case "hatColor":
			// Headphones are a band over the top of the head and a cup over each ear.
			return f.hat === HEADPHONES
				? [
						[100, t + 2, w + 14, 22],
						[L - 4, ey + 12, 16, 22],
						[R + 4, ey + 12, 16, 22],
					]
				: [[100, t - 14, w + 26, 42]];
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
export const VB = [-12, -44, 224, 298];
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

export const FACE_ASPECT = VB[3]! / VB[2]!;
