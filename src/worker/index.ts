import {validateSubmission} from "../shared/scores.ts";
import type {Env} from "./env.ts";
import {allowAll, type SubmissionGuard} from "./guard.ts";
import {overLimit, saveScore, topScores} from "./scores.ts";

export interface Options
{
	now: number;
	guard: SubmissionGuard;
}

const json = (body: unknown, status = 200): Response =>
	Response.json(
		body,
		{
			status,
			headers:
			{
				"cache-control": "no-store",
			},
		},
	);

async function submit(request: Request, env: Env, {now, guard}: Options): Promise<Response>
{
	let body: unknown;
	try
	{
		body = await request.json();
	}
	catch
	{
		return json(
			{
				error: "body must be JSON",
			},
			400,
		);
	}
	const checked = validateSubmission(body);
	if (!checked.ok)
		return json(
			{
				error: checked.error,
			},
			400,
		);
	const refused = await guard(request, env);
	if (refused) return refused;
	const ip = request.headers.get("cf-connecting-ip");
	if (await overLimit(env.DB, checked.value.deviceId, ip, now))
		return json(
			{
				error: "too many submissions, try again later",
			},
			429,
		);
	return json(
		{
			entry: await saveScore(env.DB, checked.value, ip, now),
		},
		201,
	);
}

export async function handle(request: Request, env: Env, options: Partial<Options> = {}): Promise<Response>
{
	const {pathname} = new URL(request.url);
	if (!pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
	if (pathname !== "/api/scores")
		return json(
			{
				error: "not found",
			},
			404,
		);
	const resolved: Options =
	{
		now: options.now ?? Date.now(),
		guard: options.guard ?? allowAll,
	};
	if (request.method === "GET") return json(await topScores(env.DB));
	if (request.method === "POST") return submit(request, env, resolved);
	return json(
		{
			error: "method not allowed",
		},
		405,
	);
}

export default
{
	async fetch(request: Request, env: Env): Promise<Response>
	{
		return handle(request, env);
	},
};
