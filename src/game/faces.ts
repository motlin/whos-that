import {range, rnd, shuffle} from "./util.ts";

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

export function valid(f: Face): boolean
{
	return !(f.hat && f.hairStyle === 6);
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
