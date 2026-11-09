import {afterEach, beforeEach, describe, expect, it, vi} from "vite-plus/test";
import {deviceId, Store} from "../../src/game/store.ts";
import type {Boards} from "../../src/shared/scores.ts";

const SERVER: Boards =
{
	classic: [
		{
			n: "Alice & Bob",
			s: 1626,
			l: 9,
			t: 1794196099849,
		},
	],
	spot: [],
	build: [],
	lineup: [
		{
			n: "Alice",
			s: 1185,
			l: 7,
			t: 1794195933598,
		},
	],
};

let storage: Map<string, string>;
let calls:
{
	url: string;
	init: RequestInit | undefined;
}[];

function respond(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void
{
	vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
	{
		calls.push(
			{
				url,
				init,
			},
		);
		return handler(url, init);
	});
}
const json = (body: unknown, status = 200): Response =>
	new Response(
		JSON.stringify(body),
		{
			status,
			headers:
			{
				"content-type": "application/json",
			},
		},
	);
const posted = (): unknown[] =>
	calls.filter((c) => c.init?.method === "POST").map((c) => JSON.parse(c.init?.body as string) as unknown);

beforeEach(() =>
{
	storage = new Map();
	calls = [];
	vi.stubGlobal(
		"localStorage",
		{
			getItem: (k: string) => storage.get(k) ?? null,
			setItem: (k: string, v: string) => storage.set(k, v),
		},
	);
	Store.shared = false;
});

afterEach(() =>
{
	vi.unstubAllGlobals();
});

describe("Store.load", () =>
{
	it("reads the shared board from the API", async () =>
	{
		respond(() => json(SERVER));
		expect(await Store.load()).toStrictEqual(SERVER);
		expect(
			{
				shared: Store.shared,
				urls: calls.map((c) => c.url),
			},
		).toStrictEqual(
			{
				shared: true,
				urls: ["/api/scores"],
			},
		);
	});

	it("falls back to this device's scores when the API is unreachable", async () =>
	{
		storage.set(
			"wt_boards",
			JSON.stringify(
				{
					spot: [
						{
							n: "Me",
							s: 300,
							l: 3,
							t: 5,
						},
					],
				},
			),
		);
		respond(() =>
		{
			throw new TypeError("Failed to fetch");
		});
		expect(await Store.load()).toStrictEqual(
			{
				classic: [],
				spot: [
					{
						n: "Me",
						s: 300,
						l: 3,
						t: 5,
					},
				],
				build: [],
				lineup: [],
			},
		);
		expect(Store.shared).toBe(false);
	});

	it("falls back when the API answers with an error", async () =>
	{
		respond(() =>
			json(
				{
					error: "boom",
				},
				500,
			),
		);
		expect(await Store.load()).toStrictEqual(
			{
				classic: [],
				spot: [],
				build: [],
				lineup: [],
			},
		);
		expect(Store.shared).toBe(false);
	});

	it("uploads scores saved on this device once the API is back, keeping only the ones to retry", async () =>
	{
		storage.set(
			"wt_boards",
			JSON.stringify(
				{
					classic: [
						{
							n: "Ok",
							s: 200,
							l: 2,
							t: 1,
						},
						{
							n: "Bad",
							s: 999,
							l: 2,
							t: 2,
						},
						{
							n: "Later",
							s: 150,
							l: 2,
							t: 3,
						},
					],
				},
			),
		);
		storage.set("wt_device", "device-1234");
		respond((_url, init) =>
		{
			if (init?.method !== "POST") return json(SERVER);
			const body = JSON.parse(init.body as string) as
			{
				name: string;
			};
			if (body.name === "Ok")
				return json(
					{
						entry:
						{
							n: "Ok",
							s: 200,
							l: 2,
							t: 9,
						},
					},
					201,
				);
			if (body.name === "Bad")
				return json(
					{
						error: "score is not possible at level 2",
					},
					400,
				);
			return json(
				{
					error: "too many submissions",
				},
				429,
			);
		});
		await Store.load();
		expect(posted()).toStrictEqual([
			{
				mode: "classic",
				name: "Ok",
				score: 200,
				level: 2,
				deviceId: "device-1234",
			},
			{
				mode: "classic",
				name: "Bad",
				score: 999,
				level: 2,
				deviceId: "device-1234",
			},
			{
				mode: "classic",
				name: "Later",
				score: 150,
				level: 2,
				deviceId: "device-1234",
			},
		]);
		expect(JSON.parse(storage.get("wt_boards")!)).toStrictEqual(
			{
				classic: [
					{
						n: "Later",
						s: 150,
						l: 2,
						t: 3,
					},
				],
				spot: [],
				build: [],
				lineup: [],
			},
		);
	});
});

describe("Store.save", () =>
{
	it("posts the score with this device's id and returns the server's entry time", async () =>
	{
		respond(() =>
			json(
				{
					entry:
					{
						n: "Alice",
						s: 410,
						l: 3,
						t: 777,
					},
				},
				201,
			),
		);
		expect(
			await Store.save(
				"spot",
				{
					n: "Alice",
					s: 410,
					l: 3,
					t: 1,
				},
			),
		).toStrictEqual(
			{
				ok: true,
				t: 777,
			},
		);
		expect(posted()).toStrictEqual([
			{
				mode: "spot",
				name: "Alice",
				score: 410,
				level: 3,
				deviceId: deviceId(),
			},
		]);
		expect(Store.shared).toBe(true);
		expect(storage.has("wt_boards")).toBe(false);
	});

	it("keeps the score on this device when the API cannot take it", async () =>
	{
		for (const handler of [
			(): Response =>
			{
				throw new TypeError("Failed to fetch");
			},
			(): Response =>
				json(
					{
						error: "too many submissions",
					},
					429,
				),
		])
		{
			storage.clear();
			respond(handler);
			expect(
				await Store.save(
					"build",
					{
						n: "Me",
						s: 200,
						l: 2,
						t: 42,
					},
				),
			).toStrictEqual(
				{
					ok: false,
					t: 42,
				},
			);
			expect(JSON.parse(storage.get("wt_boards")!)).toStrictEqual(
				{
					classic: [],
					spot: [],
					build: [
						{
							n: "Me",
							s: 200,
							l: 2,
							t: 42,
						},
					],
					lineup: [],
				},
			);
		}
	});
});

describe("deviceId", () =>
{
	it("is made once per device and then reused", () =>
	{
		const first = deviceId();
		expect(first).toMatch(/^[0-9a-f-]{36}$/);
		expect([deviceId(), storage.get("wt_device")]).toStrictEqual([first, first]);
	});
});
