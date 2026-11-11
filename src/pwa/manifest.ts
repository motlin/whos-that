// What makes the page an installable app: the web app manifest and the fixed files the service worker keeps for
// offline play. index.html links them, and src/pwa/register.ts registers the worker. The colors are the game's
// --paper, so the splash screen and status bar match the notebook page.
// The craft board behind the default style, Cut Paper.
const BOARD = "#1f6f6b";

type Icon =
{
	src: string;
	sizes: string;
	type: "image/png";
	purpose: "any" | "maskable";
};

export const MANIFEST =
{
	id: "/",
	name: "Who's That?",
	short_name: "Who's That?",
	description: "A face-memory game",
	start_url: "/",
	scope: "/",
	display: "standalone",
	orientation: "any",
	background_color: BOARD,
	theme_color: BOARD,
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
	] satisfies Icon[],
};

export const APPLE_TOUCH_ICON = "/icons/apple-touch-icon.png";
export const FAVICON = "/favicon.svg";

/** The files every build has. The build adds its hashed script and stylesheet; see scripts/service-worker-build.ts. */
export const PRECACHE_URLS = [
	"/",
	"/manifest.webmanifest",
	...MANIFEST.icons.map(({src}) => src),
	APPLE_TOUCH_ICON,
	FAVICON,
];
