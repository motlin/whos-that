import {PRECACHE_URLS} from "./manifest.ts";
import {dropStaleCaches, precache, respond} from "./worker.ts";

// The service worker, built to dist/sw.js by scripts/service-worker-build.ts, which puts the build's version and its
// hashed script and stylesheet in place of the placeholders. A new deploy changes that version, so the browser
// installs the new worker on the next launch. It takes over at once and deletes the old build's cache, so no player
// is left on an old version.
const VERSION = "__WHOS_THAT_SW_VERSION__";
const FILES = [...PRECACHE_URLS, ..."__WHOS_THAT_SW_ASSETS__".split(",")];

// The project's lib is the page's, so the few worker types this needs are spelled out here.
type ExtendableEvent = Event &
{
	waitUntil: (promise: Promise<unknown>) => void;
};
type FetchEvent = ExtendableEvent &
{
	request: Request;
	respondWith: (response: Promise<Response>) => void;
};
type WorkerScope =
{
	location: Location;
	skipWaiting: () => Promise<void>;
	clients:
	{
		claim: () => Promise<void>;
	};
	addEventListener: ((type: "install" | "activate", listener: (event: ExtendableEvent) => void) => void) &
		((type: "fetch", listener: (event: FetchEvent) => void) => void);
};
declare const self: WorkerScope;
const worker = self;

worker.addEventListener("install", (event) =>
{
	event.waitUntil(precache(caches, worker.location.origin, VERSION, FILES).then(async () => worker.skipWaiting()));
});

worker.addEventListener("activate", (event) =>
{
	event.waitUntil(dropStaleCaches(caches, VERSION).then(async () => worker.clients.claim()));
});

worker.addEventListener("fetch", (event) =>
{
	const response = respond(event.request, worker.location.origin, caches, VERSION, FILES, async (request) =>
		fetch(request),
	);
	if (response) event.respondWith(response);
});
