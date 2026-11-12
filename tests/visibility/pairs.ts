import {diffKeys, type Face, type FeatureKey, valid} from "../../src/game/faces.ts";
import {BASE, changedPixels, render, values} from "./render.ts";

// A change is visible when it alters this many pixels, or the other features leave at least this share of what it alters on an unobstructed face.
const MIN_PIXELS = 150;
const MIN_SHARE = 0.5;

// One check of the pairwise test: two features, on one face shape.
export interface Pair
{
	k: FeatureKey;
	c: FeatureKey;
	shape: number;
}

export interface PairResult
{
	hidden: string[];
	uncounted: FeatureKey[];
}

const unobstructed = new Map<string, number>();
function unobstructedPixels(k: FeatureKey, a: number, b: number, shape: number): number
{
	const id = `${k} ${a} ${b} ${shape}`;
	let n = unobstructed.get(id);
	if (n === undefined)
	{
		n = changedPixels(
			render(
				{
					...BASE,
					faceShape: shape,
					[k]: a,
				},
			),
			render(
				{
					...BASE,
					faceShape: shape,
					[k]: b,
				},
			),
		);
		unobstructed.set(id, n);
	}
	return n;
}

// Every change of k next to every value of c, and of c next to every value of k, on one face shape.
export function checkPair({k, c, shape}: Pair): PairResult
{
	const hidden: string[] = [];
	const uncounted = new Set<FeatureKey>();
	const face = (kv: number, cv: number): Face => (
	{
		...BASE,
		faceShape: shape,
		[k]: kv,
		[c]: cv,
	});
	const pixels = values(k).map((kv) => values(c).map((cv) => (valid(face(kv, cv)) ? render(face(kv, cv)) : null)));
	const compare = (
		changed: FeatureKey,
		a: number,
		b: number,
		other: FeatureKey,
		ov: number,
		pa: Uint8Array | null,
		pb: Uint8Array | null,
	): void =>
	{
		if (!pa || !pb) return;
		const fa = changed === k ? face(a, ov) : face(ov, a);
		const fb = changed === k ? face(b, ov) : face(ov, b);
		if (diffKeys(fa, fb).length === 0)
		{
			uncounted.add(changed);
			return;
		}
		const n = changedPixels(pa, pb);
		if (n < MIN_PIXELS && n < MIN_SHARE * unobstructedPixels(changed, a, b, fa.faceShape))
			hidden.push(`${changed} ${a}→${b} with ${other} ${ov}`);
	};
	for (const [ci, cv] of values(c).entries())
		for (const [ai, a] of values(k).entries())
			for (const b of values(k).slice(ai + 1)) compare(k, a, b, c, cv, pixels[ai]![ci]!, pixels[b]![ci]!);
	for (const [ki, kv] of values(k).entries())
		for (const [ai, a] of values(c).entries())
			for (const b of values(c).slice(ai + 1)) compare(c, a, b, k, kv, pixels[ki]![ai]!, pixels[ki]![b]!);
	return {
		hidden,
		uncounted: [...uncounted],
	};
}
