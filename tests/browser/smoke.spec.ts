import {expect, type Page, test} from "@playwright/test";
import {serveFonts} from "./harness/fonts.ts";

test.beforeEach(async ({page}) =>
{
	await serveFonts(page);
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

test("settings switch the art style, restyle the page and keep the choice after a reload", async ({page}) =>
{
	await page.goto("/");
	await page.locator("#settingsBtn").click();
	await expect(page.locator(".stylecard .sn")).toHaveText([
		"Notebook",
		"Storybook",
		"Cut Paper",
		"Pixel Arcade",
		"Modelling Clay",
	]);
	await expect(page.locator(".stylecard svg.face")).toHaveCount(5);
	await expect(page.locator('.stylecard[aria-pressed="true"]')).toHaveAttribute("data-style", "sketch");
	await page.locator('.stylecard[data-style="pixel"]').click();
	await expect(page.locator('.stylecard[aria-pressed="true"]')).toHaveAttribute("data-style", "pixel");
	await expect(page.locator("html")).toHaveAttribute("data-style", "pixel");
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-style", "pixel");
	await expect(page.locator("#heroFace svg.face")).toHaveCount(1);
});

test("a game starts at level 1 and shows the face to memorize", async ({page}) =>
{
	await page.goto("/");
	await page.locator('.mode[data-mode="classic"]').click();
	await expect(page.locator(".lvl")).toHaveText("Level 1");
	await expect(page.locator(".prompt")).toHaveText("Memorize this face!");
	await expect(page.locator(".memo .facecard svg.face")).toHaveCount(1);
});

// Phone viewports with Safari's toolbars showing.
const PHONES =
{
	"iPhone 17 Pro":
	{
		width: 402,
		height: 740,
	},
	"iPhone SE":
	{
		width: 375,
		height: 548,
	},
};
// Spot the Difference offers every category from level 23.
const CATEGORIES = [
	"Hat",
	"Hair",
	"Eyebrows",
	"Eyes",
	"Glasses",
	"Nose",
	"Mouth",
	"Ears",
	"Earrings",
	"Facial hair",
	"Cheeks",
	"Neckwear",
	"Shirt",
	"Face shape",
	"Skin color",
];
// The smallest face that still shows its features clearly.
const SMALLEST_FACE = 110;

async function spotChoices(
	page: Page,
	viewport:
	{
		width: number;
		height: number;
	},
): Promise<void>
{
	// A paused clock keeps the pick timer from ending the round while the test measures it.
	await page.clock.install();
	await page.clock.pauseAt(Date.now() + 1000);
	await page.setViewportSize(viewport);
	await page.goto("/");
	await page.locator('.mode[data-mode="spot"]').click();
	// The level splash, then the "Look closely" splash.
	await page.clock.runFor(1600);
	await page.locator("#ready").click();
	await page.clock.runFor(1100);
	await expect(page.locator("#cats .cat")).toHaveCount(4);
	await page.evaluate(async () => document.fonts.ready);
}

// Fills the grid to all fifteen categories with their real labels, the way level 23 shows it.
async function allCategories(page: Page): Promise<void>
{
	await page.evaluate((names) =>
	{
		const cats = document.querySelector("#cats")!;
		const first = cats.children[0]!;
		cats.replaceChildren(
			...names.map((name) =>
			{
				const cat = first.cloneNode(true) as Element;
				cat.querySelector("span")!.textContent = name;
				return cat;
			}),
		);
	}, CATEGORIES);
}

test("a spot-the-difference choice shows its feature, not the whole face", async ({page}) =>
{
	await spotChoices(page, PHONES["iPhone 17 Pro"]);
	const fullFace = await page.locator("#spotFace svg.face").getAttribute("viewBox");
	const crops = await page
		.locator("#cats .cat svg.face")
		.evaluateAll((svgs) => svgs.map((s) => s.getAttribute("viewBox")));
	expect(crops.filter((viewBox) => viewBox === null || viewBox === fullFace)).toStrictEqual([]);
	expect(crops.length).toBe(4);
});

for (const [phone, viewport] of Object.entries(PHONES))
{
	test(`on an ${phone}, the face and all fifteen spot-the-difference choices fit on one screen`, async ({page}) =>
	{
		await spotChoices(page, viewport);
		await allCategories(page);
		const layout = await page.evaluate((smallest) =>
		{
			const cats = [...document.querySelectorAll("#cats .cat")].map((c) => c.getBoundingClientRect());
			const scroller = document.scrollingElement!;
			return {
				overflow: scroller.scrollHeight - scroller.clientHeight,
				cut: cats.filter((r) => r.bottom > innerHeight || r.right > innerWidth || r.left < 0).length,
				choiceHeights: new Set(cats.map((r) => Math.round(r.height))).size,
				truncated: [...document.querySelectorAll<HTMLElement>("#cats .cat span")]
					.filter((label) => label.scrollWidth > label.clientWidth)
					.map((label) => label.textContent),
				faceBigEnough: document.querySelector("#spotFace")!.getBoundingClientRect().width >= smallest,
			};
		}, SMALLEST_FACE);
		expect(layout).toStrictEqual(
			{
				overflow: 0,
				cut: 0,
				choiceHeights: 1,
				truncated: [],
				faceBigEnough: true,
			},
		);
	});
}

test("on a phone in landscape, the spot-the-difference face stays big enough to read", async ({page}) =>
{
	await spotChoices(
		page,
		{
			width: 700,
			height: 360,
		},
	);
	const width = await page.locator("#spotFace").evaluate((face) => face.getBoundingClientRect().width);
	expect(width).toBeGreaterThanOrEqual(SMALLEST_FACE);
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
