import {defineConfig} from "vite-plus";

// Renders thousands of faces to pixels, so it runs apart from the unit tests.
export default defineConfig(
	{
		test:
		{
			include: ["tests/visibility/**/*.test.ts"],
			environment: "node",
			pool: "threads",
			testTimeout: 900_000,
		},
	},
);
