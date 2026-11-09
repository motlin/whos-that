import {afterEach, beforeEach, describe, expect, it} from "vite-plus/test";
import {type Boards, maxScoreForLevel} from "../../src/shared/scores.ts";
import type {D1Database} from "../../src/worker/env.ts";
import {handle, type Options} from "../../src/worker/index.ts";
import {envWith, freshDatabase} from "../support/worker.ts";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const SEEDED: Boards =
{
	classic: [
		{
			n: "Alice & Bob",
			s: 1626,
			l: 9,
			t: 1794196099849,
		},
		{
			n: "Alice",
			s: 1506,
			l: 8,
			t: 1794195338534,
		},
	],
	spot: [
		{
			n: "Alice & Bob",
			s: 1009,
			l: 6,
			t: 1794196251465,
		},
	],
	build: [],
	lineup: [
		{
			n: "Alice & Bob",
			s: 1185,
			l: 7,
			t: 1794195933598,
		},
	],
};

let db: D1Database;
let dispose: () => Promise<void>;

beforeEach(async () =>
{
	({db, dispose} = await freshDatabase());
});

afterEach(async () =>
{
	await dispose();
});

async function call(
	method: string,
	path: string,
	{
		body,
		ip = "203.0.113.7",
		options = {},
	}:
	{
		body?: unknown;
		ip?: string | null;
		options?: Partial<Options>;
	} = {},
): Promise<
{
	status: number;
	body: unknown;
}>
{
	const headers = new Headers(
		{
			"content-type": "application/json",
		},
	);
	if (ip !== null) headers.set("cf-connecting-ip", ip);
	const init: RequestInit =
	{
		method,
		headers,
	};
	if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
	const res = await handle(
		new Request(`https://whos-that.motlin.com${path}`, init),
		envWith(db),
		{
			now: NOW,
			...options,
		},
	);
	const text = await res.text();
	return {
		status: res.status,
		body: res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text,
	};
}

const submission = (over: Record<string, unknown> = {}): Record<string, unknown> => (
{
	mode: "build",
	name: "Ada",
	score: 410,
	level: 3,
	deviceId: "device-aaaa-1111",
	...over,
});

// Stands in for a Turnstile or Access check: only a request carrying the right header gets through.
const guard = (request: Request): Response | null =>
	request.headers.get("x-token") === "ok"
		? null
		: Response.json(
				{
					error: "forbidden",
				},
				{
					status: 403,
				},
			);

describe("GET /api/scores", () =>
{
	it("serves the top scores per mode", async () =>
	{
		expect(await call("GET", "/api/scores")).toStrictEqual(
			{
				status: 200,
				body: SEEDED,
			},
		);
	});

	it("keeps the top ten per mode, by score and then the earlier time", async () =>
	{
		const rows = Array.from(
			{
				length: 12,
			},
			(_, i) => [`p${i}`, 100 * (i % 4), 5, 1000 - i],
		);
		await db.batch(
			rows.map(([n, s, l, t]) =>
				db
					.prepare(
						"INSERT INTO scores (mode, name, score, level, created_at, device_id) VALUES ('build', ?, ?, ?, ?, 'x')",
					)
					.bind(n, s, l, t),
			),
		);
		const {body} = (await call("GET", "/api/scores")) as
		{
			body: Boards;
		};
		expect(body.build.map((e) => e.n)).toStrictEqual([
			"p11",
			"p7",
			"p3",
			"p10",
			"p6",
			"p2",
			"p9",
			"p5",
			"p1",
			"p8",
		]);
		expect(body.classic).toStrictEqual(SEEDED.classic);
	});
});

describe("POST /api/scores", () =>
{
	it("saves a valid score and returns the stored entry", async () =>
	{
		expect(
			await call(
				"POST",
				"/api/scores",
				{
					body: submission(
						{
							name: "  Ada  ",
						},
					),
				},
			),
		).toStrictEqual(
			{
				status: 201,
				body:
				{
					entry:
					{
						n: "Ada",
						s: 410,
						l: 3,
						t: NOW,
					},
				},
			},
		);
		const {body} = (await call("GET", "/api/scores")) as
		{
			body: Boards;
		};
		expect(body.build).toStrictEqual([
			{
				n: "Ada",
				s: 410,
				l: 3,
				t: NOW,
			},
		]);
	});

	it("rejects bodies that are not JSON or not a possible score, and stores nothing", async () =>
	{
		expect([
			await call(
				"POST",
				"/api/scores",
				{
					body: "{not json",
				},
			),
			await call(
				"POST",
				"/api/scores",
				{
					body: submission(
						{
							score: maxScoreForLevel(3) + 1,
						},
					),
				},
			),
			await call(
				"POST",
				"/api/scores",
				{
					body: submission(
						{
							mode: "arcade",
						},
					),
				},
			),
		]).toStrictEqual([
			{
				status: 400,
				body:
				{
					error: "body must be JSON",
				},
			},
			{
				status: 400,
				body:
				{
					error: "score is not possible at level 3",
				},
			},
			{
				status: 400,
				body:
				{
					error: "mode must be one of classic, spot, build, lineup",
				},
			},
		]);
		expect(
			(
				(await call("GET", "/api/scores")) as
				{
					body: Boards;
				}
			).body,
		).toStrictEqual(SEEDED);
	});

	it("allows ten submissions per device an hour", async () =>
	{
		const statuses: number[] = [];
		for (let i = 0; i < 11; i++)
			statuses.push(
				(
					await call(
						"POST",
						"/api/scores",
						{
							body: submission(),
							ip: `198.51.100.${i}`,
						},
					)
				).status,
			);
		expect(statuses).toStrictEqual([201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 429]);
		expect(
			await call(
				"POST",
				"/api/scores",
				{
					body: submission(),
					ip: "198.51.100.99",
				},
			),
		).toStrictEqual(
			{
				status: 429,
				body:
				{
					error: "too many submissions, try again later",
				},
			},
		);
		expect(
			(
				await call(
					"POST",
					"/api/scores",
					{
						body: submission(),
						options:
						{
							now: NOW + HOUR + 1,
						},
					},
				)
			).status,
		).toBe(201);
	});

	it("allows thirty submissions per IP address an hour", async () =>
	{
		const statuses: number[] = [];
		for (let i = 0; i < 31; i++)
			statuses.push(
				(
					await call(
						"POST",
						"/api/scores",
						{
							body: submission(
								{
									deviceId: `device-${i}-xxxx`,
								},
							),
						},
					)
				).status,
			);
		expect(statuses.filter((s) => s === 201).length).toBe(30);
		expect(statuses.at(-1)).toBe(429);
		expect(
			(
				await call(
					"POST",
					"/api/scores",
					{
						body: submission(),
						ip: "192.0.2.1",
					},
				)
			).status,
		).toBe(201);
	});

	it("does not count rejected submissions toward the limits", async () =>
	{
		for (let i = 0; i < 12; i++)
			await call(
				"POST",
				"/api/scores",
				{
					body: submission(
						{
							score: 999_999,
						},
					),
				},
			);
		expect(
			(
				await call(
					"POST",
					"/api/scores",
					{
						body: submission(),
					},
				)
			).status,
		).toBe(201);
	});

	it("asks the submission guard before saving, so Turnstile or Access can refuse a score there", async () =>
	{
		expect(
			await call(
				"POST",
				"/api/scores",
				{
					body: submission(),
					options:
					{
						guard,
					},
				},
			),
		).toStrictEqual(
			{
				status: 403,
				body:
				{
					error: "forbidden",
				},
			},
		);
		expect(
			(
				(await call("GET", "/api/scores")) as
				{
					body: Boards;
				}
			).body.build,
		).toStrictEqual([]);
	});
});

describe("routing", () =>
{
	it("answers other methods and API paths with JSON errors, and leaves the rest to the assets", async () =>
	{
		expect([
			await call("PUT", "/api/scores"),
			await call("GET", "/api/nope"),
			await call("GET", "/index.html"),
		]).toStrictEqual([
			{
				status: 405,
				body:
				{
					error: "method not allowed",
				},
			},
			{
				status: 404,
				body:
				{
					error: "not found",
				},
			},
			{
				status: 200,
				body: "asset /index.html",
			},
		]);
	});
});
