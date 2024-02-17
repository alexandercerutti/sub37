import { expect } from "@playwright/test";
import { RendererFixture as test } from "./RendererFixture.js";
import type { Server } from "@sub37/server";
import type { CaptionsRenderer } from "../lib/index.js";
import type { Region } from "@sub37/server";
import type { CueNode } from "@sub37/server";

declare global {
	/**
	 * Window is the interface for each browser
	 * in this case
	 */
	interface Window {
		captionsServer: Server;
	}
}

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

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(3);

	const regionsLocator = page.locator("captions-renderer > main > .region");

	const [bgColor1, bgColor2] = await Promise.all([
		regionsLocator
			.locator('span[voice="Fred"] > span')
			.evaluate((element) => element.style.backgroundColor),
		regionsLocator
			.locator('span[voice="Bill"] > span')
			.evaluate((element) => element.style.backgroundColor),
	]);

	expect(bgColor1).toBe("red");
	expect(bgColor2).toBe("blue");
});

test("An entity wrapping part of a word, should be rendered as such", async ({
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

00:00:00.000 --> 00:00:20.000
I am Fred<i>-ish</i>
`;

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(3);

	const regionsLocator = page.locator("captions-renderer > main > .region span");
	const evaluation = await regionsLocator.evaluate((element) =>
		Array.prototype.map.call(element.childNodes, (e: HTMLElement) => e.textContent),
	);

	expect(evaluation[3]).toBe(" -ish");
});

test("A global-style should get applied to all the cues", async ({
	page,
	waitForEvent,
	seekToSecond,
	pauseServing,
}) => {
	const peachpuff = `rgb(255, 218, 185)`;
	const TEST_WEBVTT_TRACK = `
WEBVTT

STYLE
::cue {
  color: peachpuff;
}

00:00:02.500 --> 00:00:22.500 align:right
<v Bill>Hi, I’m Bill

00:00:03.000 --> 00:00:25.000 region:fred align:left
<v Fred>Would
<00:00:05.250>you
<00:00:05.500>like
<00:00:05.750>to
<00:00:06.000>get
<00:00:06.250>a
<00:00:06.500>coffee?

00:00:07.500 --> 00:00:27.500 align:right
<v Bill>Sure! I’ve only had one today.

00:00:10.000 --> 00:00:30.000 region:fred align:left
<v Fred>This is my fourth!

00:00:12.500 --> 00:00:32.500 region:fred align:left
<v Fred>OK, let’s go.
`;

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(3);

	const regionsLocator = page.locator("captions-renderer > main > .region span");

	const fredLocator = regionsLocator.locator('span[voice="Fred"]');
	const billLocator = regionsLocator.locator('span[voice="Bill"]');

	expect(fredLocator.isVisible()).toBeTruthy();
	expect(billLocator.isVisible()).toBeTruthy();

	const [textColorFred, textColorBill] = await Promise.all([
		fredLocator.evaluate((element) =>
			getComputedStyle(element.children[0]).getPropertyValue("color"),
		),
		billLocator.evaluate((element) =>
			getComputedStyle(element.children[0]).getPropertyValue("color"),
		),
	]);

	expect(textColorFred).toBe(peachpuff);
	expect(textColorBill).toBe(peachpuff);
});

test("Renderer with a region of 3.2em height should be rounded to 4.5 to fit the whole next line if the line height is 1.5em and roundRegionHeightLineFit is set", async ({
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

00:00:02.500 --> 00:00:22.500 region:bill align:right
<v Bill>Hi, I’m Bill
`;

	/**
	 * Injecting a listener to rewrite the first
	 * and injecting renderer properties
	 */

	await page.evaluate(() => {
		function isRendererElement(element: Element | null): element is InstanceType<CaptionsRenderer> {
			return typeof (element as InstanceType<CaptionsRenderer>)?.setRegionProperties === "function";
		}

		const rendererElement = document.querySelector("captions-renderer");

		if (!isRendererElement(rendererElement)) {
			throw new Error("No renderer element found.");
		}

		rendererElement.setRegionProperties({
			roundRegionHeightLineFit: true,
		});

		const regionInstance = new (class implements Region {
			public height = 3.2;
			public width: number = 100;
			public lines: number = 3;
			public scroll?: "up" | "none" = "none";
			public id = "testRegionCustom";

			getOrigin(): [x: string, y: string] {
				return ["0%", "0%"];
			}
		})();

		window.captionsServer.addEventListener("cuestart", (cues: CueNode[]) => {
			for (const cue of cues) {
				if (cue.region?.id === "fred") {
					cue.region = regionInstance;
				}
			}
		});
	});

	await Promise.all([
		waitForEvent("playing"),
		page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
	]);

	await pauseServing();
	await seekToSecond(10);

	let fredRegionHeight = await page
		.locator("captions-renderer > main > .region:first-child")
		.evaluate((element) => element.style.height);

	expect(fredRegionHeight).toBe("4.5em");

	/**
	 * Now disabling the setting and seek to rerender the cues.
	 */

	await page.evaluate(() => {
		function isRendererElement(element: Element | null): element is InstanceType<CaptionsRenderer> {
			return typeof (element as InstanceType<CaptionsRenderer>)?.setRegionProperties === "function";
		}

		const rendererElement = document.querySelector("captions-renderer");

		if (!isRendererElement(rendererElement)) {
			throw new Error("No renderer element found.");
		}

		rendererElement.setRegionProperties({
			roundRegionHeightLineFit: false,
		});
	});

	await seekToSecond(9.5);
	await seekToSecond(10);

	fredRegionHeight = await page
		.locator("captions-renderer > main > .region:first-child")
		.evaluate((element) => element.style.height);

	expect(fredRegionHeight).toBe("3.2em");
});
