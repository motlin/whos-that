import {readFile} from "node:fs/promises";
import {extname, join} from "node:path";
import {chromium} from "@playwright/test";
import {serveFonts} from "../tests/browser/harness/fonts.ts";

// Renders public/og.jpg, the 1200x630 image link previews show, from the built title screen itself: its logo, its
// tagline and its hero face in the default art style, with the mode buttons, the high-score button and the corner buttons
// hidden. The fonts come from the copies in tests/fixtures/fonts, so it needs no network. Run it with `just og-image`
// after changing the title screen.
const OUT = "public/og.jpg";
// The paper grain makes a PNG of the card about 500KB, over what some apps fetch for a preview, so it is a JPEG.
const QUALITY = 85;
// The built page links its assets from the site root, so it loads under the real origin with each request answered from
// dist/ rather than from file://.
const ORIGIN = "https://whos-that.motlin.com";
const TYPES: Record<string, string> =
{
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
};

// Lays the title screen out sideways to fill the card: the logo and tagline on the left, the hero face on the right.
const CARD_CSS = `
	html, body { overflow: hidden; }
	#home, #snd, #screen .modes, #screen .row { display: none !important; }
	#screen { max-width: none; min-height: 0; height: 100vh; padding: 0 60px 0 110px; display: grid;
		grid-template-columns: 1fr auto; grid-template-rows: auto auto; column-gap: 50px; align-content: center; align-items: center; }
	#screen .logo { grid-column: 1; grid-row: 1; align-self: end; font-size: 150px; }
	#screen .tag { grid-column: 1; grid-row: 2; align-self: start; font-size: 40px; margin: 28px 0 0 10px; white-space: nowrap; }
	#screen .hero { grid-column: 2; grid-row: 1 / span 2; width: 380px; padding: 12px; margin: 0; }
`;

// The hero face is random and changes every 1.5 seconds; a fixed seed picks the same face on every run. This one
// draws a cheerful face.
const SEED = Number(process.env["OG_SEED"] ?? 8);
function seedRandom(seed: number): void
{
	let a = seed;
	Math.random = (): number =>
	{
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const browser = await chromium.launch();
try
{
	const page = await browser.newPage(
		{
			viewport:
			{
				width: 1200,
				height: 630,
			},
		},
	);
	await page.addInitScript(seedRandom, SEED);
	await serveFonts(page);
	await page.route(`${ORIGIN}/**`, async (route) =>
	{
		const path = new URL(route.request().url()).pathname;
		const file = join("dist", path === "/" ? "index.html" : path);
		await route.fulfill(
			{
				body: await readFile(file),
				contentType: TYPES[extname(file)] ?? "application/octet-stream",
			},
		);
	});
	await page.goto(
		`${ORIGIN}/`,
		{
			waitUntil: "networkidle",
		},
	);
	await page.locator("#heroFace svg.face").waitFor();
	await page.addStyleTag(
		{
			content: CARD_CSS,
		},
	);
	const loaded = await page.evaluate(async () =>
	{
		const faces = await Promise.all(
			['150px "Titan One"', '700 40px "Nunito"'].map(async (font) => document.fonts.load(font, "Who's That?")),
		);
		return faces.every((face) => face.length > 0);
	});
	if (!loaded) throw new Error("A font did not load, so the card would show a fallback font");
	await page.screenshot(
		{
			path: OUT,
			type: "jpeg",
			quality: QUALITY,
		},
	);
	console.log(`wrote ${OUT}`);
}
finally
{
	await browser.close();
}
