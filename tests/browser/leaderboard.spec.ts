import {expect, test} from "@playwright/test";

test.beforeEach(async ({page}) =>
{
	await page.route("https://fonts.googleapis.com/**", async (route) =>
		route.fulfill(
			{
				contentType: "text/css",
				body: "",
			},
		),
	);
});

test("the high scores screen renders the shared board from the API", async ({page}) =>
{
	await page.goto("/");
	const scores = page.waitForResponse((res) => res.url().endsWith("/api/scores") && res.status() === 200);
	await page.locator("#hsBtn").click();
	await scores;
	// The save test below may add a lower classic score while this runs, so only the top two are fixed.
	const rows = page.locator("#boardList .brow");
	await expect(rows.nth(0)).toHaveText(/Alice & Bob\s*Lvl 9\s*1626/);
	await expect(rows.nth(1)).toHaveText(/Alice\s*Lvl 8\s*1506/);
	await expect(page.locator("#boardNote")).toHaveText("Shared with everyone who plays this game.");
	await page.locator('.tab[data-m="lineup"]').click();
	await expect(page.locator("#boardList .brow")).toHaveText([/Alice & Bob\s*Lvl 7\s*1185/]);
	await page.locator('.tab[data-m="build"]').click();
	await expect(page.locator("#boardList")).toHaveText("No scores yet. Be the first!");
});

test("the board falls back to this device when the API is unreachable", async ({page}) =>
{
	await page.route("**/api/**", async (route) => route.abort());
	await page.goto("/");
	await page.evaluate(() =>
	{
		localStorage.setItem(
			"wt_boards",
			JSON.stringify(
				{
					classic: [
						{
							n: "Offline",
							s: 200,
							l: 2,
							t: 1,
						},
					],
				},
			),
		);
	});
	await page.locator("#hsBtn").click();
	await expect(page.locator("#boardList .brow")).toHaveText([/Offline\s*Lvl 2\s*200/]);
	await expect(page.locator("#boardNote")).toHaveText("Saved on this device.");
});

test("a game's score saves to the shared board and is highlighted there", async ({page}) =>
{
	await page.goto("/");
	await page.locator('.mode[data-mode="classic"]').click();
	// The right answer is drawn with exactly the same SVG as the face shown to memorize.
	const face = await page.locator(".memo .facecard").innerHTML();
	await page.locator("#ready").click();
	await page
		.locator(".pick")
		.filter(
			{
				has: page.locator("svg"),
			},
		)
		.first()
		.waitFor();
	const picks = page.locator(".pick");
	const count = await picks.count();
	let right = -1;
	for (let i = 0; i < count; i++) if ((await picks.nth(i).innerHTML()) === face) right = i;
	expect(right).toBeGreaterThanOrEqual(0);
	await picks.nth(right).click();
	await expect(page.locator(".lvl")).toHaveText("Level 2");
	const second = await page.locator(".memo .facecard").innerHTML();
	await page.locator("#ready").click();
	await page.locator(".pick").first().waitFor();
	const wrong = page.locator(".pick");
	for (let i = 0; i < (await wrong.count()); i++)
	{
		if ((await wrong.nth(i).innerHTML()) !== second)
		{
			await wrong.nth(i).click();
			break;
		}
	}
	await expect(page.locator(".prompt.bad")).toHaveText("Oops! Not quite.");
	await expect(page.locator(".newhs")).toHaveText("🌟 You made the Top 10! 🌟");
	await page.locator("#nm").fill("E2E Tester");
	await page.locator("#saveHs").click();
	await expect(page.locator("#boardList .brow.me")).toHaveText(/E2E Tester\s*Lvl 2\s*\d{3}/);
	await expect(page.locator("#boardNote")).toHaveText("Shared with everyone who plays this game.");
});
