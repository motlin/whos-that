import {defineConfig} from "@playwright/test";

const port = process.env["WHOS_THAT_PORT"] ?? "4827";

export default defineConfig(
	{
		testDir: "tests/browser",
		testMatch: "*.spec.ts",
		fullyParallel: true,
		workers: process.env["CI"] ? 2 : "75%",
		timeout: 60_000,
		reporter: process.env["CI"] ? "github" : "line",
		forbidOnly: !!process.env["CI"],
		use:
		{
			browserName: "chromium",
			baseURL: `http://127.0.0.1:${port}`,
		},
		webServer:
		{
			command: "node tests/browser/harness/serve.ts",
			url: `http://127.0.0.1:${port}/`,
			reuseExistingServer: false,
		},
	},
);
