import {readdirSync, readFileSync} from "node:fs";
import {type Browser, type BrowserContext, expect, type Page, test} from "@playwright/test";
import {MANIFEST, PRECACHE_URLS} from "../../src/pwa/manifest.ts";
import {cacheName} from "../../src/pwa/worker.ts";

// The build minifies the worker, which may quote the version with backticks.
const version = (): string => /[`"']([0-9a-f]{16})[`"']/.exec(readFileSync("dist/sw.js", "utf8"))?.[1] ?? "";
// The build's hashed script and stylesheet, which the worker keeps along with the fixed files.
const assets = (): string[] =>
	readdirSync("dist/assets")
		.toSorted()
		.map((file) => `/assets/${file}`);

const openContext = async (browser: Browser): Promise<BrowserContext> =>
{
	const context = await browser.newContext(
		{
			serviceWorkers: "allow",
		},
	);
	// The fonts come from Google; the game falls back to its system fonts without them, online or off.
	await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => route.abort());
	return context;
};

/** Loads the page and waits until its worker has installed, activated and taken control of it. */
const launch = async (context: BrowserContext, url: string): Promise<Page> =>
{
	const page = await context.newPage();
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(url);
	await page.evaluate(async () => navigator.serviceWorker.ready.then(() => undefined));
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	expect(errors).toStrictEqual([]);
	return page;
};

test("the page links a manifest that Chromium reads without errors and can install", async ({browser, baseURL}) =>
{
	const context = await openContext(browser);
	const page = await launch(context, `${baseURL}/`);
	const cdp = await context.newCDPSession(page);
	const manifest = (await cdp.send("Page.getAppManifest", {})) as
	{
		url: string;
		errors: unknown[];
		data: string;
	};
	expect(
		{
			url: manifest.url,
			errors: manifest.errors,
			data: JSON.parse(manifest.data),
		},
	).toStrictEqual(
		{
			url: `${baseURL}/manifest.webmanifest`,
			errors: [],
			data: MANIFEST,
		},
	);
	expect(await cdp.send("Page.getInstallabilityErrors")).toStrictEqual(
		{
			installabilityErrors: [],
		},
	);
	await context.close();
});

test("the Worker serves the manifest, the worker script and the icons with their types", async ({request}) =>
{
	const served = await Promise.all(
		[...PRECACHE_URLS, "/sw.js"].map(async (path) =>
		{
			const response = await request.get(path);
			return [path, response.status(), response.headers()["content-type"]];
		}),
	);
	expect(served).toStrictEqual([
		["/", 200, "text/html; charset=utf-8"],
		["/manifest.webmanifest", 200, "application/manifest+json; charset=utf-8"],
		["/icons/icon-192.png", 200, "image/png"],
		["/icons/icon-512.png", 200, "image/png"],
		["/icons/icon-maskable-512.png", 200, "image/png"],
		["/icons/apple-touch-icon.png", 200, "image/png"],
		["/favicon.svg", 200, "image/svg+xml"],
		["/sw.js", 200, "text/javascript; charset=utf-8"],
	]);
});

test("the worker registers, controls the page and keeps exactly this build's cache", async ({browser, baseURL}) =>
{
	const context = await openContext(browser);
	const page = await launch(context, `${baseURL}/`);
	expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${baseURL}/sw.js`);
	expect(await page.evaluate(async () => caches.keys())).toStrictEqual([cacheName(version())]);
	expect(
		await page.evaluate(
			async (name) => (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname),
			cacheName(version()),
		),
	).toStrictEqual([...PRECACHE_URLS, ...assets()]);
	await context.close();
});

test("offline, a reload still shows the title screen and starts a game", async ({browser, baseURL}) =>
{
	const context = await openContext(browser);
	const page = await launch(context, `${baseURL}/`);
	await context.setOffline(true);
	expect(
		await page.evaluate(async () =>
			fetch("/og.png").then(
				() => "online",
				() => "offline",
			),
		),
	).toBe("offline");

	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.reload();
	await expect(page.locator(".logo")).toHaveText("Who's That?");
	await expect(page.locator("#heroFace svg.face")).toHaveCount(1);
	await page.locator('.mode[data-mode="classic"]').click();
	await expect(page.locator(".lvl")).toHaveText("Level 1");
	await expect(page.locator(".memo .facecard svg.face")).toHaveCount(1);
	expect(errors).toStrictEqual([]);
	await context.close();
});
