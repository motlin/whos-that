import {readFileSync} from "node:fs";
import {expect, test} from "vite-plus/test";
import {APPLE_TOUCH_ICON, FAVICON, MANIFEST, PRECACHE_URLS} from "../../../src/pwa/manifest.ts";

const read = (path: string): Buffer => readFileSync(new URL(`../../../${path}`, import.meta.url));

// A PNG's width and height sit in its IHDR chunk, right after the 8-byte signature and the chunk's length and type.
const pngSize = (bytes: Buffer): string => `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;

test("the manifest installs a standalone app in the notebook paper's color", () =>
{
	expect(MANIFEST).toStrictEqual(
		{
			id: "/",
			name: "Who's That?",
			short_name: "Who's That?",
			description: "A face-memory game",
			start_url: "/",
			scope: "/",
			display: "standalone",
			orientation: "any",
			background_color: "#1f6f6b",
			theme_color: "#1f6f6b",
			icons: [
				{
					src: "/icons/icon-192.png",
					sizes: "192x192",
					type: "image/png",
					purpose: "any",
				},
				{
					src: "/icons/icon-512.png",
					sizes: "512x512",
					type: "image/png",
					purpose: "any",
				},
				{
					src: "/icons/icon-maskable-512.png",
					sizes: "512x512",
					type: "image/png",
					purpose: "maskable",
				},
			],
		},
	);
});

test("every icon the manifest names is a PNG of the size it claims", () =>
{
	expect(MANIFEST.icons.map(({src}) => pngSize(read(`public${src}`)))).toStrictEqual(
		MANIFEST.icons.map(({sizes}) => sizes),
	);
	expect(pngSize(read(`public${APPLE_TOUCH_ICON}`))).toBe("180x180");
});

test("the maskable icon keeps the face inside the safe zone, the circle of 80% of its width", () =>
{
	// The face sits in a square; its corners have to stay inside the circle of radius 0.4 that every mask keeps.
	const svg = read("scripts/icons/icon-maskable.svg").toString("utf8");
	const [, x, y, size] = /<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="\3"/.exec(svg) ?? [];
	const viewBox = /viewBox="0 0 (\d+) \1"/.exec(svg)?.[1];
	expect(
		{
			x,
			y,
			viewBox,
		},
	).toStrictEqual(
		{
			x: String((64 - Number(size)) / 2),
			y: String((64 - Number(size)) / 2),
			viewBox: "64",
		},
	);
	expect((Number(size) / 2) * Math.SQRT2).toBeLessThanOrEqual(0.4 * 64);
	// It fills the whole square, so no mask shape shows a transparent corner.
	expect(svg).toContain('<rect width="64" height="64" fill="#1f6f6b"/>');
});

test("the page links the manifest and gives Safari the tags it reads for a home screen app", () =>
{
	const html = read("index.html").toString("utf8");
	const tags = [
		...html.matchAll(
			/<(?:link rel="(?:manifest|icon|apple-touch-icon)"|meta name="(?:theme-color|[\w-]*web-app-[\w-]+)")[^>]*>/g,
		),
	].map(([tag]) => tag);
	expect(tags).toStrictEqual([
		'<link rel="manifest" href="/manifest.webmanifest">',
		'<meta name="theme-color" content="#1f6f6b">',
		'<meta name="mobile-web-app-capable" content="yes">',
		'<meta name="apple-mobile-web-app-capable" content="yes">',
		'<meta name="apple-mobile-web-app-status-bar-style" content="default">',
		`<meta name="apple-mobile-web-app-title" content="Who's That?">`,
		'<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
		'<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
	]);
	expect(tags[1]).toContain(MANIFEST.theme_color);
	expect(tags[6]).toContain(FAVICON);
	expect(tags[7]).toContain(APPLE_TOUCH_ICON);
});

test("the worker keeps the page, the manifest and every icon for offline play", () =>
{
	expect(PRECACHE_URLS).toStrictEqual([
		"/",
		"/manifest.webmanifest",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/icons/icon-maskable-512.png",
		"/icons/apple-touch-icon.png",
		"/favicon.svg",
	]);
});

test("Cloudflare serves the manifest as a manifest and never lets the worker go stale", () =>
{
	expect(read("public/_headers").toString("utf8")).toBe(`/sw.js
  Cache-Control: no-cache
  Content-Type: text/javascript; charset=utf-8

/manifest.webmanifest
  Content-Type: application/manifest+json; charset=utf-8
  Cache-Control: no-cache
`);
});
