import {range, rnd, shuffle} from "./util.ts";

export const SKIN = ["#fde3c8", "#f5c79e", "#e0a878", "#c58552", "#9a5f37", "#6b4226"];
export const HAIRC = ["#2b2118", "#734a26", "#ecc65a", "#c9512b", "#a9a9a9", "#4a8fe0", "#ff7eb6"];
export const EYEC = ["#6b3e1f", "#3a7bd5", "#3fa34d", "#8a8f98", "#9b4dca"];
export const CLOTH = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#ff8c42", "#1abc9c"];
export const HATC = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#ff8c42", "#f06292"];

export type FeatureKey =
	| "faceShape"
	| "skin"
	| "hairStyle"
	| "hairColor"
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
	| "shirt";
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
		n: 6,
		label: "skin color",
	},
	hairStyle:
	{
		n: 10,
		label: "hair style",
	},
	hairColor:
	{
		n: 7,
		label: "hair color",
	},
	eyebrows:
	{
		n: 6,
		label: "eyebrows",
	},
	eyes:
	{
		n: 7,
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
		n: 8,
		label: "mouth",
	},
	ears:
	{
		n: 5,
		label: "ears",
	},
	facialHair:
	{
		n: 6,
		label: "beard or mustache",
		w: [10, 2, 1, 2, 1.5, 1.5],
	},
	glasses:
	{
		n: 6,
		label: "glasses",
		w: [11, 2, 2, 1.5, 1, 1],
	},
	hat:
	{
		n: 8,
		label: "hat",
		w: [12, 1.5, 1.5, 1, 1, 1, 1, 1],
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
		n: 3,
		label: "earrings",
		w: [5, 1.5, 1.5],
	},
	neckwear:
	{
		n: 5,
		label: "neckwear",
		w: [4, 1.5, 1.5, 1.5, 1.5],
	},
	shirt:
	{
		n: 7,
		label: "shirt color",
	},
};
export const KEYS = Object.keys(FEATURES) as FeatureKey[];
const HAT_COLORED = new Set([1, 2, 3, 5, 6, 7]);
// The curls of hair style 9 are drawn over the ears: only the pointy (3) and sideways (4) ears poke out, and earrings never do.
const CURLS = 9;
const EARS_PAST_CURLS = new Set([3, 4]);

function visible(f: Face, k: FeatureKey): boolean
{
	if ((k === "eyes" || k === "eyeColor") && f.glasses === 3) return false;
	if (k === "hatColor" && !HAT_COLORED.has(f.hat)) return false;
	if (k === "earrings" && f.hairStyle === CURLS) return false;
	if (k === "ears" && f.hairStyle === CURLS && !EARS_PAST_CURLS.has(f.ears)) return false;
	return true;
}

function valid(f: Face): boolean
{
	return !(f.hat && f.hairStyle === 7);
}

function randFeat(k: FeatureKey): number
{
	const F = FEATURES[k];
	if (F.w)
	{
		const t = F.w.reduce((a, b) => a + b);
		let r = Math.random() * t;
		for (let i = 0; i < F.n; i++)
		{
			r -= F.w[i]!;
			if (r < 0) return i;
		}
		return 0;
	}
	return rnd(F.n);
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
