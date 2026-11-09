import {defineConfig} from "vite-plus";

export default defineConfig(
	{
		test:
		{
			include: ["tests/unit/**/*.test.ts", "tests/worker/**/*.test.ts"],
			environment: "node",
			pool: "threads",
			testTimeout: 60_000,
		},
	},
);
