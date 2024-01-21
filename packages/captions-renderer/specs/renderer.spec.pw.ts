import { expect } from "@playwright/test";
import { RendererFixture as test } from "./RendererFixture.js";

const SUB37_SAMPLE_PAGE_PATH = "./pages/sub37-example/index.html";

test("Renderer should render two regions if the tracks owns two regions", async ({
	page,
	waitForEvent,
	pauseServing,
	seekToSecond,
}) => {
	const TEST_WEBVTT_TRACK = `
WEBVTT

REGION
id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up

REGION
id:bill
width:40%
lines:3
regionanchor:100%,100%
viewportanchor:90%,90%
scroll:up

00:00:00.000 --> 00:00:20.000 region:fred align:left
<v Fred>Hi, my name is Fred

00:00:02.500 --> 00:00:22.500 region:bill align:right
<v Bill>Hi, I’m Bill
`;

	await page.goto(SUB37_SAMPLE_PAGE_PATH);

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(3);

	expect((await page.$$("captions-renderer > main > div")).length).toBe(2);
});

test("Renderer should render two regions, one of them is the default one", async ({
	page,
	waitForEvent,
	seekToSecond,
	pauseServing,
}) => {
	const TEST_WEBVTT_TRACK = `
WEBVTT

REGION
id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up

00:00:00.000 --> 00:00:20.000 region:fred align:left
<v Fred>Hi, my name is Fred

00:00:02.500 --> 00:00:22.500 align:right
<v Bill>Hi, I’m Bill
`;

	await page.goto(SUB37_SAMPLE_PAGE_PATH);

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(3);

	expect((await page.$$("captions-renderer > main > div")).length).toBe(2);
});

test("Renderer should render 'Fred' region with a red background color and a 'Bill' region with a blue background color", async ({
	page,
	waitForEvent,
	seekToSecond,
	pauseServing,
}) => {
	/**
	 * @typedef {import("../../sample/src/customElements/fake-video")} FakeHTMLVideoElement
	 */

	const TEST_WEBVTT_TRACK = `
WEBVTT

REGION
id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up

STYLE
::cue(v[voice="Fred"]) {
	background-color: red;
}

STYLE
::cue([voice="Bill"]) {
	background-color: blue;
}

00:00:00.000 --> 00:00:20.000 region:fred
<v Fred>Hi, my name is Fred

00:00:02.500 --> 00:00:22.500
<v Bill>Hi, I’m Bill
`;

	await page.goto(SUB37_SAMPLE_PAGE_PATH);

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(3);

	const regionsLocator = page.locator("captions-renderer > main > .region");

	const [bgColor1, bgColor2] = await Promise.all([
		regionsLocator
			.locator('span[voice="Fred"]')
			.evaluate((element) => element.style.backgroundColor),
		regionsLocator
			.locator('span[voice="Bill"]')
			.evaluate((element) => element.style.backgroundColor),
	]);

	expect(bgColor1).toBe("red");
	expect(bgColor2).toBe("blue");
});
