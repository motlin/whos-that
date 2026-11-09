import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import type {Plugin} from "vite-plus";
import {MANIFEST, PRECACHE_URLS} from "../src/pwa/manifest.ts";

const SW_FILE = "sw.js";
const VERSION = "__WHOS_THAT_SW_VERSION__";
const ASSETS = "__WHOS_THAT_SW_ASSETS__";

/** A version for the build: a hash of every file the worker keeps, in order, so any change to one is a new version. */
export function buildVersion(files: (string | Uint8Array)[]): string
{
	const hash = createHash("sha256");
	for (const file of files)
	{
		const bytes = typeof file === "string" ? Buffer.from(file, "utf8") : file;
		hash.update(`${bytes.length}:`).update(bytes);
	}
	return hash.digest("hex").slice(0, 16);
}

/**
 * Builds src/pwa/sw.ts to dist/sw.js and writes dist/manifest.webmanifest. It runs after the page is final, puts the
 * page's hashed script and stylesheet into the worker as files to keep, and puts a hash of the page, those files, the
 * manifest and the public files the worker keeps into the worker as its cache version. The icons and the _headers file
 * for Cloudflare are copied from public/ as they are.
 */
export function serviceWorker(): Plugin
{
	return {
		name: "service-worker",
		apply: "build",
		enforce: "post",
		buildStart()
		{
			this.emitFile(
				{
					type: "chunk",
					id: resolve("src/pwa/sw.ts"),
					fileName: SW_FILE,
				},
			);
		},
		generateBundle(_options, bundle)
		{
			const page = bundle["index.html"];
			const worker = bundle[SW_FILE];
			if (page?.type !== "asset") throw new Error("index.html is missing from the bundle");
			if (worker?.type !== "chunk") throw new Error(`${SW_FILE} is missing from the bundle`);
			if (worker.imports.length > 0 || /^\s*(?:import|export)\b/m.test(worker.code))
				throw new Error(`${SW_FILE} has to be a classic script, with nothing shared with the page`);
			const assets = Object.entries(bundle)
				.filter(([name]) => name.startsWith("assets/"))
				.toSorted(([a], [b]) => (a < b ? -1 : 1))
				.map(([, file]) => file);
			if (assets.length === 0) throw new Error("the page has no script or stylesheet in assets/");
			const manifest = `${JSON.stringify(MANIFEST, null, "\t")}\n`;
			const publicFiles = PRECACHE_URLS.filter((url) => url !== "/" && url !== "/manifest.webmanifest").map((url) =>
				readFileSync(`public${url}`),
			);
			const version = buildVersion([
				String(page.source),
				...assets.map((file) => (file.type === "chunk" ? file.code : file.source)),
				manifest,
				...publicFiles,
			]);
			for (const placeholder of [VERSION, ASSETS])
				if (!worker.code.includes(placeholder)) throw new Error(`${SW_FILE} lost its ${placeholder} placeholder`);
			worker.code = worker.code
				.replaceAll(VERSION, version)
				.replaceAll(ASSETS, assets.map((file) => `/${file.fileName}`).join(","));
			this.emitFile(
				{
					type: "asset",
					fileName: "manifest.webmanifest",
					source: manifest,
				},
			);
		},
	};
}
