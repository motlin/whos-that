import {type Boards, emptyBoards, MODE_IDS, type ModeId, type ScoreEntry, sortTop} from "../shared/scores.ts";
import {ls} from "./util.ts";

// The shared board lives behind the Worker's /api/scores. When it cannot be reached, scores stay in localStorage
// under the artifact's own key, and the next load that reaches the API uploads them.
const API = "/api/scores";
const TIMEOUT_MS = 10_000;

export function deviceId(): string
{
	let id = ls.get("wt_device");
	if (!id)
	{
		id = crypto.randomUUID();
		ls.set("wt_device", id);
	}
	return id;
}

function clean(e: unknown): ScoreEntry | null
{
	if (!e || typeof e !== "object") return null;
	const x = e as Record<string, unknown>;
	if (typeof x["s"] !== "number" || typeof x["n"] !== "string") return null;
	return {
		n: x["n"].slice(0, 12),
		s: Math.max(0, Math.floor(x["s"])),
		l: Math.max(0, Math.floor(Number(x["l"]) || 0)),
		t: Number(x["t"]) || 0,
	};
}

function parseBoards(x: unknown): Boards
{
	const o = emptyBoards();
	if (!x || typeof x !== "object") return o;
	for (const id of MODE_IDS)
	{
		const list = (x as Record<string, unknown>)[id];
		if (Array.isArray(list)) o[id] = list.map((e) => clean(e)).filter((e) => e !== null);
	}
	return o;
}

function localRaw(): Boards
{
	try
	{
		return parseBoards(JSON.parse(ls.get("wt_boards") ?? "{}"));
	}
	catch
	{
		// A hand-edited or corrupt board reads as empty, as it always has.
		return emptyBoards();
	}
}

async function post(mode: ModeId, entry: ScoreEntry): Promise<Response>
{
	return fetch(
		API,
		{
			method: "POST",
			headers:
			{
				"content-type": "application/json",
			},
			body: JSON.stringify(
				{
					mode,
					name: entry.n,
					score: entry.s,
					level: entry.l,
					deviceId: deviceId(),
				},
			),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		},
	);
}

// Uploads the scores this device kept while offline. An accepted or invalid score is done with; a refused one
// (rate limit, server error, network) stays for the next try.
async function migrate(): Promise<void>
{
	const local = localRaw();
	if (!MODE_IDS.some((id) => local[id].length)) return;
	const keep = emptyBoards();
	let reachable = true;
	for (const id of MODE_IDS)
	{
		for (const entry of local[id])
		{
			if (reachable)
			{
				try
				{
					// oxlint-disable-next-line no-await-in-loop -- one at a time, so an unreachable API stops the rest.
					const res = await post(id, entry);
					if (res.ok || res.status === 400) continue;
				}
				catch
				{
					reachable = false;
				}
			}
			keep[id].push(entry);
		}
	}
	ls.set("wt_boards", JSON.stringify(keep));
}

export const Store =
{
	shared: false,
	async load(): Promise<Boards>
	{
		try
		{
			await migrate();
			const res = await fetch(
				API,
				{
					signal: AbortSignal.timeout(TIMEOUT_MS),
				},
			);
			if (!res.ok) throw new Error(`GET ${API} answered ${res.status}`);
			const boards = sortTop(parseBoards(await res.json()));
			this.shared = true;
			return boards;
		}
		catch
		{
			this.shared = false;
			return sortTop(localRaw());
		}
	},
	async save(
		mode: ModeId,
		entry: ScoreEntry,
	): Promise<
	{
		ok: boolean;
		t: number;
	}>
	{
		try
		{
			const res = await post(mode, entry);
			if (res.ok)
			{
				const saved = clean(
					(
						(await res.json()) as
						{
							entry?: unknown;
						}
					).entry,
				);
				this.shared = true;
				return {
					ok: true,
					t: saved?.t ?? entry.t,
				};
			}
		}
		catch
		{
			// Unreachable: keep the score on this device below.
		}
		const o = localRaw();
		o[mode].push(entry);
		ls.set("wt_boards", JSON.stringify(sortTop(o)));
		return {
			ok: false,
			t: entry.t,
		};
	},
};
