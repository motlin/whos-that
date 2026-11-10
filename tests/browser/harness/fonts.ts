import {readFileSync} from "node:fs";
import {basename} from "node:path";
import type {Page} from "@playwright/test";

const fonts = new URL("../../fixtures/fonts/", import.meta.url);
// Each family's file and weights. Nunito is one variable font that covers every weight the game uses.
const FACES =
{
	"Gochi Hand": ["gochi-hand-latin.woff2", "400"],
	"Patrick Hand": ["patrick-hand-latin.woff2", "400"],
	Nunito: ["nunito-latin.woff2", "200 1000"],
	"Titan One": ["titan-one-latin.woff2", "400"],
};

// Answers the Google Fonts stylesheet and font files from tests/fixtures/fonts, so layout tests measure the real
// hand-drawn fonts without touching the network.
export async function serveFonts(page: Page): Promise<void>
{
	const css = Object.entries(FACES)
		.map(
			([family, [file, weight]]) =>
				`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(https://fonts.gstatic.com/test/${file}) format('woff2')}`,
		)
		.join("\n");
	await page.route("https://fonts.googleapis.com/**", async (route) =>
		route.fulfill(
			{
				contentType: "text/css",
				body: css,
			},
		),
	);
	await page.route("https://fonts.gstatic.com/test/*", async (route) =>
		route.fulfill(
			{
				contentType: "font/woff2",
				headers:
				{
					"access-control-allow-origin": "*",
				},
				body: readFileSync(new URL(basename(new URL(route.request().url()).pathname), fonts)),
			},
		),
	);
}
