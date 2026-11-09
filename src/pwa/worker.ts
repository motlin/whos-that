// The service worker's logic, apart from the worker global so that tests can hand it fake caches and a fake network.
const PREFIX = "whos-that-";

export const cacheName = (version: string): string => PREFIX + version;

/** Every cache this game made for another build. Caches of other apps on the origin are left alone. */
export const staleCaches = (names: string[], version: string): string[] =>
	names.filter((name) => name.startsWith(PREFIX) && name !== cacheName(version));

/** Fetches every file the game needs past the HTTP cache, so a new build never stores an old file. */
export async function precache(caches: CacheStorage, origin: string, version: string, files: string[]): Promise<void>
{
	const cache = await caches.open(cacheName(version));
	await cache.addAll(
		files.map(
			(url) =>
				new Request(
					new URL(url, origin),
					{
						cache: "reload",
					},
				),
		),
	);
}

export async function dropStaleCaches(caches: CacheStorage, version: string): Promise<void>
{
	await Promise.all(staleCaches(await caches.keys(), version).map(async (name) => caches.delete(name)));
}

/**
 * The response for a request the page makes, or undefined to leave it to the browser. A page load tries the network
 * first, so a new deploy shows on the next launch, and falls back to the cached page for any address in scope. Kept
 * files come from the cache. The leaderboard API always goes to the network, and the game keeps scores on the device
 * when it cannot reach it.
 */
export function respond(
	request: Request,
	origin: string,
	caches: CacheStorage,
	version: string,
	files: string[],
	fetcher: (request: Request) => Promise<Response>,
): Promise<Response> | undefined
{
	const url = new URL(request.url);
	if (request.method !== "GET" || url.origin !== origin || url.pathname.startsWith("/api/")) return undefined;
	const cached = async (path: string): Promise<Response | undefined> =>
		(await caches.open(cacheName(version))).match(path);
	if (request.mode === "navigate")
		return (async () =>
		{
			try
			{
				return await fetcher(request);
			}
			catch (error)
			{
				const page = await cached("/");
				if (page) return page;
				throw error;
			}
		})();
	if (url.search === "" && files.includes(url.pathname))
		return (async () => (await cached(url.pathname)) ?? fetcher(request))();
	return fetcher(request);
}
