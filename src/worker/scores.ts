import {type Boards, emptyBoards, MODE_IDS, type ScoreEntry, type Submission} from "../shared/scores.ts";
import type {D1Database} from "./env.ts";

const HOUR_MS = 3_600_000;
const DEVICE_LIMIT = 10;
const IP_LIMIT = 30;

export async function topScores(db: D1Database): Promise<Boards>
{
	const results = await db.batch<ScoreEntry>(
		MODE_IDS.map((mode) =>
			db
				.prepare(
					"SELECT name AS n, score AS s, level AS l, created_at AS t FROM scores WHERE mode = ? ORDER BY score DESC, created_at ASC, id ASC LIMIT 10",
				)
				.bind(mode),
		),
	);
	const boards = emptyBoards();
	for (const [i, mode] of MODE_IDS.entries()) boards[mode] = results[i]?.results ?? [];
	return boards;
}

const limitKeys = (deviceId: string, ip: string | null): [string, number][] =>
	ip === null
		? [[`device:${deviceId}`, DEVICE_LIMIT]]
		: [
				[`device:${deviceId}`, DEVICE_LIMIT],
				[`ip:${ip}`, IP_LIMIT],
			];

// True when this device, or this IP address when there is one, already has its hour's worth of accepted submissions.
export async function overLimit(db: D1Database, deviceId: string, ip: string | null, now: number): Promise<boolean>
{
	const keys = limitKeys(deviceId, ip);
	const {results} = await db
		.prepare(
			`SELECT key, COUNT(*) AS n FROM submissions WHERE at > ? AND key IN (${keys.map(() => "?").join(", ")}) GROUP BY key`,
		)
		.bind(now - HOUR_MS, ...keys.map(([key]) => key))
		.all<
		{
			key: string;
			n: number;
		}>();
	return keys.some(([key, limit]) => (results.find((r) => r.key === key)?.n ?? 0) >= limit);
}

// Saves the score and counts the submission against its limits in one batch, dropping counts older than an hour.
export async function saveScore(db: D1Database, entry: Submission, ip: string | null, now: number): Promise<ScoreEntry>
{
	await db.batch([
		db
			.prepare("INSERT INTO scores (mode, name, score, level, created_at, device_id) VALUES (?, ?, ?, ?, ?, ?)")
			.bind(entry.mode, entry.name, entry.score, entry.level, now, entry.deviceId),
		...limitKeys(entry.deviceId, ip).map(([key]) =>
			db.prepare("INSERT INTO submissions (key, at) VALUES (?, ?)").bind(key, now),
		),
		db.prepare("DELETE FROM submissions WHERE at <= ?").bind(now - HOUR_MS),
	]);
	return {
		n: entry.name,
		s: entry.score,
		l: entry.level,
		t: now,
	};
}
