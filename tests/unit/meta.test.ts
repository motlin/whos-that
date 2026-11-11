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

// A JPEG's height and width follow the start-of-frame marker; markers before it carry their own lengths.
function jpegSize(path: string): [number, number]
{
	const jpeg = read(path);
	let i = 2;
	while (jpeg[i + 1] !== 0xc0 && jpeg[i + 1] !== 0xc2) i += 2 + jpeg.readUInt16BE(i + 2);
	return [jpeg.readUInt16BE(i + 7), jpeg.readUInt16BE(i + 5)];
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
		`<meta property="og:image" content="https://whos-that.motlin.com/og.jpg">`,
		`<meta property="og:image:width" content="1200">`,
		`<meta property="og:image:height" content="630">`,
		`<meta property="og:image:alt" content="The words Who's That? in chunky cream letters beside a cut-paper face of a smiling woman with a gray afro, a star on her cheek and blue earrings, on a teal board">`,
		`<meta name="twitter:card" content="summary_large_image">`,
		`<meta name="twitter:title" content="Who's That? A face-memory game">`,
		`<meta name="twitter:description" content="${DESCRIPTION}">`,
		`<meta name="twitter:image" content="https://whos-that.motlin.com/og.jpg">`,
		`<meta name="theme-color" content="#1f6f6b">`,
		`<meta name="mobile-web-app-capable" content="yes">`,
		`<meta name="apple-mobile-web-app-capable" content="yes">`,
		`<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
		`<meta name="apple-mobile-web-app-title" content="Who's That?">`,
		`<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
		`<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`,
	]);
});

// WhatsApp is reported to drop preview images over 300KB.
const MAX_PREVIEW_BYTES = 300_000;

it("ships the preview card at 1200x630 and the icons the page links", () =>
{
	expect(
		{
			size: jpegSize("public/og.jpg"),
			small: read("public/og.jpg").length <= MAX_PREVIEW_BYTES,
		},
	).toStrictEqual(
		{
			size: [1200, 630],
			small: true,
		},
	);
	expect(pngSize("public/icons/apple-touch-icon.png")).toStrictEqual([180, 180]);
	const favicon = read("public/favicon.svg").toString("utf8");
	expect(favicon.startsWith("<svg ")).toBe(true);
	// The icon is drawn in the default style, Cut Paper, and carries that style's filter with it.
	expect(
		{
			defaultStyle: favicon.includes('filter="url(#paper-cut)"') && favicon.includes('<filter id="paper-cut"'),
			notebookFilter: favicon.includes("url(#wob)"),
		},
	).toStrictEqual(
		{
			defaultStyle: true,
			notebookFilter: false,
		},
	);
});

it("sizes the layout by the small viewport, so Safari's toolbars never cover it", () =>
{
	const css = read("src/styles/game.css").toString("utf8");
	const units = new Set([...css.matchAll(/\d(d?[sld]?vh)\b/g)].map(([, unit]) => unit));
	expect([...units]).toStrictEqual(["svh"]);
});
