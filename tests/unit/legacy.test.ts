import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vite-plus/test";
import {LEGACY_PATH} from "../support/legacy.ts";

it("keeps legacy/original.html byte-identical to the source artifact", () =>
{
	expect(createHash("sha256").update(readFileSync(LEGACY_PATH)).digest("hex")).toBe(
		"5b2cea0f5b627bfcdcbafa3c5895e0b8d9e294f99b4f22c0d614a1a1dd77f809",
	);
});
