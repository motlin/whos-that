import {pick, range, rnd, shuffle} from "./util.ts";

export const SKIN = ["#ffe4ca", "#eab380", "#bd7c46", "#7e4c29", "#452816"];
// Natural colors, for the hair, eyebrows and facial hair.
export const HAIRC = ["#2b2118", "#734a26", "#ecc65a", "#c9512b", "#999999", "#f6f3ec"];
// Dye colors the hair on the head only. The first entry is no dye.
export const DYEC = ["", "#4a8fe0", "#ff7eb6", "#35b56a", "#8e5be0"];
export const EYEC = ["#6b3e1f", "#3a7bd5", "#3fa34d", "#8a8f98", "#9b4dca"];
export const CLOTH = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#ff8c42", "#1abc9c"];
export const HATC = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#ff8c42", "#f06292"];

export type FeatureKey =
	| "faceShape"
	| "skin"
	| "hairStyle"
	| "hairColor"
	| "hairDye"
	| "eyebrows"
	| "eyes"
	| "eyeColor"
	| "nose"
	| "mouth"
	| "ears"
	| "facialHair"
	| "glasses"
	| "hat"
	| "hatColor"
	| "cheeks"
	| "earrings"
	| "neckwear"
	| "shirt"
	| "shirtStyle";
export type Face = Record<FeatureKey, number>;
interface Feature
{
	n: number;
	label: string;
	w?: number[];
}

export const FEATURES: Record<FeatureKey, Feature> =
{
	faceShape:
	{
		n: 5,
		label: "face shape",
	},
	skin:
	{
		n: 5,
		label: "skin color",
	},
	hairStyle:
	{
		n: 14,
		label: "hair style",
	},
	hairColor:
	{
		n: 6,
		label: "hair color",
	},
	hairDye:
	{
		n: 5,
		label: "hair dye",
		w: [6, 1, 1, 1, 1],
	},
	eyebrows:
	{
		n: 6,
		label: "eyebrows",
	},
	eyes:
	{
		n: 6,
		label: "eyes",
	},
	eyeColor:
	{
		n: 5,
		label: "eye color",
	},
	nose:
	{
		n: 7,
		label: "nose",
	},
	mouth:
	{
		n: 9,
		label: "mouth",
	},
	ears:
	{
		n: 4,
		label: "ears",
	},
	facialHair:
	{
		n: 11,
		label: "beard or mustache",
		w: [10, 2, 1.5, 2, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
	},
	glasses:
	{
		n: 6,
		label: "glasses",
		w: [11, 2, 2, 1.5, 1, 1],
	},
	hat:
	{
		n: 12,
		label: "hat",
		w: [12, 1.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	},
	hatColor:
	{
		n: 6,
		label: "hat color",
	},
	cheeks:
	{
		n: 6,
		label: "cheeks",
		w: [4, 1.5, 1.5, 1, 1, 1],
	},
	earrings:
	{
		n: 5,
		label: "earrings",
		w: [5, 1.5, 1.5, 1.5, 1.5],
	},
	neckwear:
	{
		n: 7,
		label: "neckwear",
		w: [4, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
	},
	shirt:
	{
		n: 7,
		label: "shirt color",
	},
	shirtStyle:
	{
		n: 6,
		label: "shirt pattern",
		w: [3, 1, 1, 1, 1, 1],
	},
};
export const KEYS = Object.keys(FEATURES) as FeatureKey[];
const HAT_COLORED = new Set([1, 2, 3, 5, 6, 7, 8, 9]);

function visible(f: Face, k: FeatureKey): boolean
{
	if (k === "hatColor" && !HAT_COLORED.has(f.hat)) return false;
	if (k === "hairDye" && f.hairStyle === 0) return false;
	return true;
}

// How far apart, summed over red, green and blue, a hat's color must be from the hair or bare head under it.
const MIN_HAT_CONTRAST = 100;
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string): number =>
{
	const [x, y] = [rgb(a), rgb(b)];
	return x.reduce((s, v, i) => s + Math.abs(v - y[i]!), 0);
};
// The color of the head's crown: dyed or natural hair, or skin when bald.
const crownColor = (f: Face): string =>
	f.hairStyle === 0 ? SKIN[f.skin]! : f.hairDye ? DYEC[f.hairDye]! : HAIRC[f.hairColor]!;

export function valid(f: Face): boolean
{
	if (f.hat && f.hairStyle === 6) return false;
	// A colored hat on hair of its own color melts into it, so a hat whose color is asked about never matches the hair.
	return !(visible(f, "hatColor") && distance(HATC[f.hatColor]!, crownColor(f)) < MIN_HAT_CONTRAST);
}

// An index drawn in proportion to its weight.
function weighted(w: readonly number[]): number
{
	let r = Math.random() * w.reduce((a, b) => a + b);
	for (const [i, x] of w.entries())
	{
		r -= x;
		if (r < 0 && x > 0) return i;
	}
	return w.findLastIndex((x) => x > 0);
}

function randFeat(k: FeatureKey): number
{
	const F = FEATURES[k];
	return F.w ? weighted(F.w) : rnd(F.n);
}

export function randomFace(): Face
{
	let f: Face;
	do
	{
		f = {} as Face;
		for (const k of KEYS) f[k] = randFeat(k);
	}
	while (!valid(f));
	return f;
}

export const visKey = (f: Face): string => KEYS.map((k) => (visible(f, k) ? f[k] : "x")).join(",");
export const diffKeys = (a: Face, b: Face): FeatureKey[] =>
	KEYS.filter((k) => a[k] !== b[k] && visible(a, k) && visible(b, k));

export function makeDecoy(t: Face, n: number, pool: readonly FeatureKey[], used: Set<string>): Face
{
	for (let tries = 0; tries < 300; tries++)
	{
		const d =
		{
			...t,
		};
		let done = 0;
		for (const k of shuffle([...new Set(pool)]))
		{
			if (done >= n) break;
			if (!visible(d, k)) continue;
			const old = d[k];
			let ok = false;
			for (const v of shuffle(range(FEATURES[k].n).filter((x) => x !== old)))
			{
				d[k] = v;
				if (valid(d) && visible(d, k))
				{
					ok = true;
					break;
				}
			}
			if (ok) done++;
			else d[k] = old;
		}
		if (done < Math.min(n, 1) || !diffKeys(t, d).length) continue;
		const vk = visKey(d);
		if (used.has(vk)) continue;
		used.add(vk);
		return d;
	}
	let f: Face;
	do f = randomFace();
	while (used.has(visKey(f)));
	used.add(visKey(f));
	return f;
}

// How many tries to find a lineup that keeps every face apart, adding a feature to the mix every so often.
const LINEUP_TRIES = 400;
const TRIES_PER_FEATURE = 40;

// The wrong faces for a lineup of size faces around t. Each face takes either t's value or one other value for a few
// features, in a random pattern that keeps every two faces at least d features apart, and t is a random one of the
// patterns, so no face is more typical of the lineup than the right one.
export function makeLineup(t: Face, size: number, d: number, pool: readonly FeatureKey[], used: Set<string>): Face[]
{
	if (size < 2) return [];
	const base = Math.max(d, Math.ceil(Math.log2(size)));
	const keys = [...new Set(pool)].filter((k) => visible(t, k));
	for (let tries = 0; tries < LINEUP_TRIES; tries++)
	{
		const m = Math.min(keys.length, base + Math.floor(tries / TRIES_PER_FEATURE));
		const contested = shuffle([...keys]).slice(0, m);
		const other = contested.map((k) => otherValue(t, k));
		if (2 ** m < size) continue;
		const patterns = new Set<number>();
		while (patterns.size < size) patterns.add(rnd(2 ** m));
		// t's own pattern: every face that matches it on a feature has t's value there.
		const mine = pick([...patterns]);
		const wrong: Face[] = [];
		for (const p of patterns)
		{
			if (p === mine) continue;
			const f =
			{
				...t,
			};
			contested.forEach((k, j) =>
			{
				if (((p ^ mine) >> j) & 1) f[k] = other[j]!;
			});
			wrong.push(f);
		}
		const faces = [t, ...wrong];
		const seen = wrong.map(visKey);
		if (
			!wrong.every(valid) ||
			new Set([visKey(t), ...seen]).size < size ||
			seen.some((k) => used.has(k)) ||
			faces.some((a, i) => faces.slice(i + 1).some((b) => diffKeys(a, b).length < d))
		)
			continue;
		for (const k of seen) used.add(k);
		return wrong;
	}
	return range(size - 1).map(() => makeDecoy(t, d, pool, used));
}

// A value of k other than t's, as likely as it would be on a new face.
function otherValue(t: Face, k: FeatureKey): number
{
	const w = FEATURES[k].w ?? Array<number>(FEATURES[k].n).fill(1);
	return weighted(w.map((x, v) => (v === t[k] ? 0 : x)));
}
