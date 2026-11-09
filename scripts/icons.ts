import {writeFileSync} from "node:fs";
import {faceSVG} from "../src/game/draw.ts";
import type {Face} from "../src/game/faces.ts";

// Draws the icons from the game's own face code: one fixed, cheerful face, chosen feature by feature so every run
// gives the same file. `just icons` runs this, then renders the apple-touch-icon PNG from its SVG.
const FACE: Face =
{
	faceShape: 1, // round
	skin: 1,
	hairStyle: 1,
	hairColor: 1, // brown
	eyebrows: 0,
	eyes: 0,
	eyeColor: 1,
	nose: 0,
	mouth: 1, // toothy grin
	ears: 0,
	facialHair: 0,
	glasses: 0,
	hat: 0,
	hatColor: 0,
	cheeks: 1,
	earrings: 0,
	neckwear: 0,
	shirt: 0,
};

// The head and shoulders, square, so the face fills the icon.
const VIEW = "4 24 192 192";
const SUN = "#ffe066";
const INK = "#2a2522";

// The game's #wob filter lives in index.html, out of reach of a standalone file, and its wobble only blurs a 32px
// icon, so the icon drops it. Thicker lines keep the features readable that small.
const face = faceSVG(
	FACE,
	{
		vb: VIEW,
	},
)
	.replace(' filter="url(#wob)"', "")
	.replace('stroke-width="3"', 'stroke-width="6"');
const inner = face.slice(face.indexOf(">") + 1, face.lastIndexOf("</svg>"));

function icon(background: string): string
{
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${background}<svg x="4" y="4" width="56" height="56" viewBox="${VIEW}">${inner}</svg></svg>\n`;
}

// The favicon is a rounded sun-yellow tile with an ink border; the touch icon fills its square, since iOS rounds the
// corners itself.
writeFileSync(
	"public/favicon.svg",
	icon(`<rect x="1.5" y="1.5" width="61" height="61" rx="14" fill="${SUN}" stroke="${INK}" stroke-width="3"/>`),
);
writeFileSync("scripts/icons/apple-touch-icon.svg", icon(`<rect width="64" height="64" fill="${SUN}"/>`));
console.log("wrote public/favicon.svg and scripts/icons/apple-touch-icon.svg");
