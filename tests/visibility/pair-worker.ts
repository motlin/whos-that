import {parentPort} from "node:worker_threads";
import {checkPair, type Pair} from "./pairs.ts";

// Runs pairwise checks off the test's thread. The event loop turns between messages, which lets resvg free each
// check's renders before the next.
parentPort!.on("message", (pair: Pair) =>
{
	parentPort!.postMessage(checkPair(pair));
});
