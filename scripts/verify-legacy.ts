import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";

const EXPECTED = "5b2cea0f5b627bfcdcbafa3c5895e0b8d9e294f99b4f22c0d614a1a1dd77f809";
const actual = createHash("sha256").update(readFileSync("legacy/original.html")).digest("hex");
if (actual !== EXPECTED)
{
	console.error(`legacy/original.html has been edited: sha256 ${actual}, expected ${EXPECTED}`);
	process.exit(1);
}
console.log("legacy/original.html is byte-identical to the source artifact");
