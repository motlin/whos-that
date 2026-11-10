-- One row per score saved to the shared board. GET /api/scores reads the top ten of each mode.
CREATE TABLE scores (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	mode TEXT NOT NULL CHECK (mode IN ('classic', 'spot', 'build', 'lineup')),
	name TEXT NOT NULL,
	score INTEGER NOT NULL CHECK (score >= 0),
	level INTEGER NOT NULL CHECK (level >= 1),
	created_at INTEGER NOT NULL,
	device_id TEXT NOT NULL
);
CREATE INDEX scores_by_rank ON scores (mode, score DESC, created_at ASC, id ASC);

-- One row per accepted submission, keyed 'device:<id>' or 'ip:<address>', kept for an hour for the rate limits.
CREATE TABLE submissions (
	key TEXT NOT NULL,
	at INTEGER NOT NULL
);
CREATE INDEX submissions_by_key ON submissions (key, at);
