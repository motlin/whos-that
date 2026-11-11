import {expect, test} from "vite-plus/test";
import {buildVersion} from "../../../scripts/service-worker-build.ts";
import {PRECACHE_URLS} from "../../../src/pwa/manifest.ts";
import {cacheName, dropStaleCaches, precache, respond, staleCaches} from "../../../src/pwa/worker.ts";

const ORIGIN = "https://whos-that.example";
// The build adds its hashed script and stylesheet to the files the worker keeps.
const FILES = [...PRECACHE_URLS, "/assets/index-abc123.js", "/assets/index-def456.css"];

const urlOf = (request: RequestInfo | URL): string =>
	new URL(request instanceof Request ? request.url : String(request), ORIGIN).href;

// Just enough of CacheStorage for the worker: one Map of URL to body text per named cache.
class FakeCaches
{
	readonly stores = new Map<string, Map<string, string>>();
	readonly reloads: string[] = [];

	async open(name: string): Promise<Cache>
	{
		const store = this.stores.get(name) ?? new Map<string, string>();
		this.stores.set(name, store);
		return Promise.resolve(
			{
				addAll: async (requests: RequestInfo[]) =>
				{
					for (const request of requests)
					{
						this.reloads.push(request instanceof Request ? request.cache : "default");
						store.set(urlOf(request), `body of ${new URL(urlOf(request)).pathname}`);
					}
					return Promise.resolve();
				},
				match: async (request: RequestInfo | URL) =>
				{
					const body = store.get(urlOf(request));
					return Promise.resolve(body === undefined ? undefined : new Response(body));
				},
			} as unknown as Cache,
		);
	}

	async keys(): Promise<string[]>
	{
		return Promise.resolve([...this.stores.keys()]);
	}

	async delete(name: string): Promise<boolean>
	{
		return Promise.resolve(this.stores.delete(name));
	}
}

const offline = async (): Promise<Response> => Promise.reject(new TypeError("Failed to fetch"));
const online = async (request: Request): Promise<Response> =>
	Promise.resolve(new Response(`network ${new URL(request.url).pathname}${new URL(request.url).search}`));
const navigation = (path: string): Request =>
{
	const request = new Request(ORIGIN + path);
	Object.defineProperty(
		request,
		"mode",
		{
			value: "navigate",
		},
	);
	return request;
};
const text = async (response: Response | undefined): Promise<string | undefined> => response?.text();

test("the version comes from the built files, so any change to them makes a new cache", () =>
{
	const page = "<!doctype html><title>Who's That?</title>";
	const icon = new Uint8Array([137, 80, 78, 71]);
	const version = buildVersion([page, icon]);
	expect(version).toMatch(/^[0-9a-f]{16}$/);
	expect(buildVersion([page, icon])).toBe(version);
	expect(buildVersion([`${page} `, icon])).not.toBe(version);
	expect(buildVersion([page, new Uint8Array([137, 80, 78, 72])])).not.toBe(version);
	expect(buildVersion([icon, page])).not.toBe(version);
	expect(cacheName(version)).toBe(`whos-that-${version}`);
});

test("only the game's caches from other versions are stale", () =>
{
	expect(staleCaches(["whos-that-aaa", "whos-that-bbb", "someone-else", "whos-that-ccc"], "bbb")).toStrictEqual([
		"whos-that-aaa",
		"whos-that-ccc",
	]);
});

test("installing fetches every file past the HTTP cache into this version's cache", async () =>
{
	const caches = new FakeCaches();
	await precache(caches as unknown as CacheStorage, ORIGIN, "v2", FILES);
	expect([...caches.stores.keys()]).toStrictEqual(["whos-that-v2"]);
	expect([...caches.stores.get("whos-that-v2")!.keys()]).toStrictEqual(FILES.map((url) => ORIGIN + url));
	expect(caches.reloads).toStrictEqual(FILES.map(() => "reload"));
});

test("activating deletes the caches of older versions", async () =>
{
	const caches = new FakeCaches();
	await caches.open("whos-that-v1");
	await caches.open("whos-that-v2");
	await caches.open("other-app");
	await dropStaleCaches(caches as unknown as CacheStorage, "v2");
	expect([...caches.stores.keys()]).toStrictEqual(["whos-that-v2", "other-app"]);
});

test("a launch online gets the page from the network, so a new deploy shows at once", async () =>
{
	const caches = new FakeCaches();
	await precache(caches as unknown as CacheStorage, ORIGIN, "v1", FILES);
	const response = respond(navigation("/?from=home"), ORIGIN, caches as unknown as CacheStorage, "v1", FILES, online);
	expect(await text(await response)).toBe("network /?from=home");
});

test("a launch offline gets the cached page for any address in scope", async () =>
{
	const caches = new FakeCaches();
	await precache(caches as unknown as CacheStorage, ORIGIN, "v1", FILES);
	const bodies = await Promise.all(
		["/", "/?from=home", "/index.html"].map(async (path) =>
			text(await respond(navigation(path), ORIGIN, caches as unknown as CacheStorage, "v1", FILES, offline)),
		),
	);
	expect(bodies).toStrictEqual(["body of /", "body of /", "body of /"]);
});

test("a launch offline with nothing cached fails as the network did", async () =>
{
	const caches = new FakeCaches();
	await expect(
		respond(navigation("/"), ORIGIN, caches as unknown as CacheStorage, "v1", FILES, offline)!,
	).rejects.toThrow("Failed to fetch");
});

test("kept files come from the cache, and anything else goes to the network", async () =>
{
	const caches = new FakeCaches();
	await precache(caches as unknown as CacheStorage, ORIGIN, "v1", FILES);
	const fromCache = await Promise.all(
		["/icons/icon-192.png", "/assets/index-abc123.js"].map(async (path) =>
			text(
				await respond(
					new Request(ORIGIN + path),
					ORIGIN,
					caches as unknown as CacheStorage,
					"v1",
					FILES,
					offline,
				),
			),
		),
	);
	expect(fromCache).toStrictEqual(["body of /icons/icon-192.png", "body of /assets/index-abc123.js"]);
	const other = respond(
		new Request(`${ORIGIN}/og.jpg`),
		ORIGIN,
		caches as unknown as CacheStorage,
		"v1",
		FILES,
		online,
	);
	expect(await text(await other)).toBe("network /og.jpg");
});

test("the worker leaves the leaderboard API, other origins and other methods to the browser", () =>
{
	const caches = new FakeCaches() as unknown as CacheStorage;
	expect(
		[
			new Request(`${ORIGIN}/api/scores`),
			new Request("https://fonts.googleapis.com/css2?family=Gochi+Hand"),
			new Request(
				`${ORIGIN}/`,
				{
					method: "POST",
				},
			),
		].map((request): Promise<Response> | undefined => respond(request, ORIGIN, caches, "v1", FILES, online)),
	).toStrictEqual([undefined, undefined, undefined]);
});
