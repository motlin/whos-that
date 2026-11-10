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

// An iPhone 17 Pro's viewport with Safari's toolbars showing.
const PHONE =
{
	width: 402,
	height: 740,
};
// Spot the Difference offers every category from level 23.
const MOST_CHOICES = 15;

test("on a phone, every spot-the-difference choice shows its feature and fits on screen", async ({page}) =>
{
	await page.setViewportSize(PHONE);
	await page.goto("/");
	await page.locator('.mode[data-mode="spot"]').click();
	await page.locator("#ready").click();
	await expect(page.locator("#cats .cat")).toHaveCount(4);
	const fullFace = await page.locator("#spotFace svg.face").getAttribute("viewBox");
	const crops = await page
		.locator("#cats .cat svg.face")
		.evaluateAll((svgs) => svgs.map((s) => s.getAttribute("viewBox")));
	expect(crops.filter((viewBox) => viewBox === null || viewBox === fullFace)).toStrictEqual([]);
	expect(crops.length).toBe(4);

	const offScreen = await page.evaluate((most) =>
	{
		const cats = document.querySelector("#cats")!;
		while (cats.children.length < most) cats.append(cats.children[0]!.cloneNode(true));
		return {
			overflow: Math.max(0, document.scrollingElement!.scrollHeight - innerHeight),
			cut: [...cats.children].filter((c) =>
			{
				const r = c.getBoundingClientRect();
				return r.bottom > innerHeight || r.right > innerWidth || r.left < 0;
			}).length,
		};
	}, MOST_CHOICES);
	expect(offScreen).toStrictEqual(
		{
			overflow: 0,
			cut: 0,
		},
	);
});

test("the Worker serves the preview card and the icons as static files", async ({request}) =>
{
	const types = await Promise.all(
		["/og.png", "/favicon.svg", "/icons/apple-touch-icon.png"].map(async (path) =>
		{
			const response = await request.get(path);
			return [path, response.status(), response.headers()["content-type"]];
		}),
	);
	expect(types).toStrictEqual([
		["/og.png", 200, "image/png"],
		["/favicon.svg", 200, "image/svg+xml"],
		["/icons/apple-touch-icon.png", 200, "image/png"],
	]);
});
