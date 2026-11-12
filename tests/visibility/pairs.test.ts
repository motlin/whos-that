import {availableParallelism} from "node:os";
import {Worker} from "node:worker_threads";
import {expect, it} from "vite-plus/test";
import {KEYS} from "../../src/game/faces.ts";
import type {Pair, PairResult} from "./pairs.ts";
import {BASE, values} from "./render.ts";

// Every check of the pairwise test, the slowest first so the threads finish together.
const PAIRS: Pair[] = KEYS.flatMap((k, i) =>
	KEYS.slice(i + 1).flatMap((c) =>
		(k === "faceShape" || c === "faceShape" ? [BASE.faceShape] : values("faceShape")).map((shape) => (
		{
			k,
			c,
			shape,
		})),
	),
).toSorted((a, b) => values(b.k).length * values(b.c).length - values(a.k).length * values(a.c).length);

// Runs every check on its own thread, as many threads as the machine has cores.
async function checkPairs(): Promise<PairResult[]>
{
	const results: PairResult[] = [];
	let next = 0;
	const thread = async (): Promise<void> =>
	{
		const worker = new Worker(new URL("pair-worker.ts", import.meta.url));
		try
		{
			while (next < PAIRS.length)
			{
				const pair = PAIRS[next++]!;
				results.push(
					await new Promise<PairResult>((resolve, reject) =>
					{
						worker.once("message", resolve);
						worker.once("error", reject);
						worker.postMessage(pair);
					}),
				);
				worker.removeAllListeners("error");
			}
		}
		finally
		{
			await worker.terminate();
		}
	};
	await Promise.all(
		Array.from(
			{
				length: Math.min(availableParallelism(), PAIRS.length),
			},
			thread,
		),
	);
	return results;
}

// Every change of one feature, next to every value of one other feature, on every face shape.
it("draws every difference the game counts so that it can be seen", async () =>
{
	const results = await checkPairs();
	expect(
		{
			hidden: [...new Set(results.flatMap((r) => r.hidden))].toSorted(),
			uncounted: new Set(results.flatMap((r) => r.uncounted)),
		},
	).toStrictEqual(
		{
			hidden: [],
			uncounted: new Set(["hairDye", "hatColor"]),
		},
	);
});
