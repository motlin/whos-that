import {readFileSync} from "node:fs";
import {expect, it} from "vite-plus/test";

const root = new URL("../../", import.meta.url);
const read = (path: string): Buffer => readFileSync(new URL(path, root));

// A PNG's width and height are the two big-endian words right after the IHDR chunk type, at bytes 16 and 20.
function pngSize(path: string): [number, number]
{
	const png = read(path);
	expect(png.subarray(12, 16).toString("latin1")).toBe("IHDR");
	return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function head(): string[]
{
	const html = read("index.html").toString("utf8");
	return [...html.matchAll(/<(?:meta (?:name|property)="[^"]+"|link rel="(?:icon|apple-touch-icon)")[^>]*>/g)].map(
		([tag]) => tag,
	);
}

const DESCRIPTION =
	"Memorize a face, then find it: pick it out of a lineup, spot what changed, or build it back piece by piece.";

it("gives link previews a title, description and an absolute image URL, and links the icons", () =>
{
	expect(head()).toStrictEqual([
		`<meta name="viewport" content="width=device-width, initial-scale=1">`,
		`<meta name="description" content="${DESCRIPTION}">`,
		`<meta property="og:type" content="website">`,
		`<meta property="og:site_name" content="Who's That?">`,
		`<meta property="og:title" content="Who's That? A face-memory game">`,
		`<meta property="og:description" content="${DESCRIPTION}">`,
		`<meta property="og:url" content="https://whos-that.motlin.com/">`,
		`<meta property="og:image" content="https://whos-that.motlin.com/og.png">`,
		`<meta property="og:image:width" content="1200">`,
		`<meta property="og:image:height" content="630">`,
		`<meta property="og:image:alt" content="The words Who's That? in hand-drawn letters beside a sketch of a smiling bearded man in a red cap on lined notebook paper">`,
		`<meta name="twitter:card" content="summary_large_image">`,
		`<meta name="twitter:title" content="Who's That? A face-memory game">`,
		`<meta name="twitter:description" content="${DESCRIPTION}">`,
		`<meta name="twitter:image" content="https://whos-that.motlin.com/og.png">`,
		`<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
		`<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
	]);
});

it("ships the preview card at 1200x630 and the icons the page links", () =>
{
	expect(pngSize("public/og.png")).toStrictEqual([1200, 630]);
	expect(pngSize("public/apple-touch-icon.png")).toStrictEqual([180, 180]);
	const favicon = read("public/favicon.svg").toString("utf8");
	expect(favicon.startsWith("<svg ")).toBe(true);
	// index.html defines the game's #wob filter, which a standalone favicon cannot see.
	expect(favicon.includes("url(#wob)")).toBe(false);
});
