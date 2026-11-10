import {writeFileSync} from "node:fs";
import {faceSVG} from "../src/game/draw.ts";
import type {Face} from "../src/game/faces.ts";

// Draws the icons from the game's own face code: one fixed, cheerful face, chosen feature by feature so every run
// gives the same file. `just icons` runs this, then renders the PNGs in public/icons/ from the SVGs.
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

function icon(background: string, inset = 4): string
{
	const size = 64 - 2 * inset;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${background}<svg x="${inset}" y="${inset}" width="${size}" height="${size}" viewBox="${VIEW}">${inner}</svg></svg>\n`;
}

// The favicon, which is also the manifest's plain app icon, is a rounded sun-yellow tile with an ink border. The touch
// icon fills its square, since iOS rounds the corners itself. The maskable icon fills its square too, and shrinks the
// face into the middle so that its corners stay inside the circle of 80% of the width that every mask shape keeps.
const FILL = `<rect width="64" height="64" fill="${SUN}"/>`;
writeFileSync(
	"public/favicon.svg",
	icon(`<rect x="1.5" y="1.5" width="61" height="61" rx="14" fill="${SUN}" stroke="${INK}" stroke-width="3"/>`),
);
writeFileSync("scripts/icons/apple-touch-icon.svg", icon(FILL));
writeFileSync("scripts/icons/icon-maskable.svg", icon(FILL, 14));
console.log("wrote public/favicon.svg, scripts/icons/apple-touch-icon.svg and scripts/icons/icon-maskable.svg");
