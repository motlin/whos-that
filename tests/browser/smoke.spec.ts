import {expect, test} from "@playwright/test";

test.beforeEach(async ({page}) =>
{
	// The fonts come from Google; an empty stylesheet keeps the test off the network.
	await page.route("https://fonts.googleapis.com/**", async (route) =>
		route.fulfill(
			{
				contentType: "text/css",
				body: "",
			},
		),
	);
});

test("the title screen shows the four modes and a face", async ({page}) =>
{
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/");
	await expect(page.locator(".logo")).toHaveText("Who's That?");
	await expect(page.locator(".mode .mt")).toHaveText(["Classic", "Spot the Difference", "Build It", "Lineup"]);
	await expect(page.locator("#heroFace svg.face")).toHaveCount(1);
	expect(errors).toStrictEqual([]);
});

test("a game starts at level 1 and shows the face to memorize", async ({page}) =>
{
	await page.goto("/");
	await page.locator('.mode[data-mode="classic"]').click();
	await expect(page.locator(".lvl")).toHaveText("Level 1");
	await expect(page.locator(".prompt")).toHaveText("Memorize this face!");
	await expect(page.locator(".memo .facecard svg.face")).toHaveCount(1);
});
