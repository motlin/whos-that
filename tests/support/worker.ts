import {readdirSync, readFileSync} from "node:fs";
import {convertV4MiniflareOptions, Miniflare} from "miniflare";
import type {D1Database, Env} from "../../src/worker/env.ts";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);
const FIXTURES = new URL("../fixtures/scores.sql", import.meta.url);

// Splits a migration into statements: comments dropped, one statement per trailing semicolon.
function statements(sql: string): string[]
{
	return sql
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n")
		.split(/;\s*$/m)
		.map((s) => s.trim())
		.filter(Boolean);
}

// A fresh in-memory D1 from miniflare with every migration in migrations/ applied in order, as wrangler would,
// then the invented scores in tests/fixtures/scores.sql.
export async function freshDatabase(): Promise<
{
	db: D1Database;
	dispose: () => Promise<void>;
}>
{
	const mf = new Miniflare(
		convertV4MiniflareOptions(
			{
				modules: true,
				script: "export default {fetch() {return new Response(null, {status: 404});}};",
				d1Databases:
				{
					DB: "whos-that",
				},
			},
		),
	);
	const db = (await mf.getD1Database("DB")) as unknown as D1Database;
	for (const file of readdirSync(MIGRATIONS)
		.filter((f) => f.endsWith(".sql"))
		.toSorted())
	{
		const sql = readFileSync(new URL(file, MIGRATIONS), "utf8");
		await db.batch(statements(sql).map((s) => db.prepare(s)));
	}
	await db.batch(statements(readFileSync(FIXTURES, "utf8")).map((s) => db.prepare(s)));
	return {
		db,
		dispose: async () => mf.dispose(),
	};
}

export function envWith(db: D1Database): Env
{
	return {
		DB: db,
		ASSETS:
		{
			fetch: async (request: Request) => Promise.resolve(new Response(`asset ${new URL(request.url).pathname}`)),
		},
	};
}
