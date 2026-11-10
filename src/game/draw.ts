import type {Face, FeatureKey} from "./faces.ts";
import {N1, regions, VB} from "./geometry.ts";
import {currentStyle} from "./styles/index.ts";
import type {ArtStyle} from "./styles/style.ts";

export {cropBox, FACE_ASPECT, featureBox} from "./geometry.ts";

export interface FaceOptions
{
	hl?: FeatureKey[] | null | undefined;
	good?: boolean;
	mark?: [number, number] | undefined;
	vb?: string | null;
}

// Draws a face in the player's chosen style, or in the one given.
export function faceSVG(f: Face, o: FaceOptions = {}, style: ArtStyle = currentStyle()): string
{
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
	return `<svg viewBox="${o.vb ?? VB.join(" ")}" preserveAspectRatio="xMidYMid meet" class="face" xmlns="http://www.w3.org/2000/svg">${style.paint(f)}${hl}${mk}</svg>`;
}
