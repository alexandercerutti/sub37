import { expect } from "@playwright/test";
import { RendererFixture as test } from "./RendererFixture.js";
import type { Server } from "@sub37/server";
import type { CaptionsRenderer } from "../lib/index.js";
import type { Region, CueNode } from "@sub37/adapter-utils";

declare global {
	/**
	 * Window is the interface for each browser
	 * in this case
	 */
	interface Window {
		captionsServer: Server;
	}
}

test.describe("WebVTT", () => {
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

		expect(await page.locator("captions-renderer > main > sub37-region").count()).toBe(2);
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

		expect(await page.locator("captions-renderer > main > sub37-region").count()).toBe(2);
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
::cue(v[voice="Bill"]) {
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

		const regionsLocator = page.locator("captions-renderer > main > sub37-region");

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

		const regionsLocator = page.locator("captions-renderer > main > sub37-region span");
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

		const regionsLocator = page.locator("captions-renderer > main > sub37-region span");

		const fredLocator = regionsLocator.locator('span[voice="Fred"]');
		const billLocator = regionsLocator.locator('span[voice="Bill"]');

		expect(fredLocator.isVisible()).toBeTruthy();
		expect(billLocator.isVisible()).toBeTruthy();

		const [textColorFred, textColorBill] = await Promise.all([
			fredLocator.evaluate((element) => getComputedStyle(element).getPropertyValue("color")),
			billLocator.evaluate((element) => getComputedStyle(element).getPropertyValue("color")),
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
			function isRendererElement(
				element: Element | null,
			): element is InstanceType<CaptionsRenderer> {
				return (
					typeof (element as InstanceType<CaptionsRenderer>)?.setRegionProperties === "function"
				);
			}

			const rendererElement = document.querySelector("captions-renderer");

			if (!isRendererElement(rendererElement)) {
				throw new Error("No renderer element found.");
			}

			rendererElement.setRegionProperties({
				snapHeightToLineGrid: false,
			});

			const regionInstance = new (class implements Region {
				public height: string = "3.2em";
				public width: string = "100%";
				public lines: number = 3;
				public entities = [];
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
			.locator("captions-renderer > main > sub37-region:first-child")
			.evaluate((element) => element.style.height);

		expect(fredRegionHeight).toBe("4.5em");

		/**
		 * Now enabling the setting and seek to rerender the cues.
		 */

		await page.evaluate(() => {
			function isRendererElement(
				element: Element | null,
			): element is InstanceType<CaptionsRenderer> {
				return (
					typeof (element as InstanceType<CaptionsRenderer>)?.setRegionProperties === "function"
				);
			}

			const rendererElement = document.querySelector("captions-renderer");

			if (!isRendererElement(rendererElement)) {
				throw new Error("No renderer element found.");
			}

			rendererElement.setRegionProperties({
				snapHeightToLineGrid: true,
			});
		});

		await seekToSecond(25);
		await seekToSecond(10);

		fredRegionHeight = await page
			.locator("captions-renderer > main > sub37-region:first-child")
			.evaluate((element) => element.style.height);

		expect(fredRegionHeight).toMatch(/^\d+(?:\.\d+)?px$/);
	});

	test("WebVTT cue with a newline in the middle should render on two separate lines", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		/*
		 * No trailing newline: a cue content that ends with \x0A causes
		 * splitCueNodeByBreakpoints to assign the same variation ID to all
		 * sub-cues, collapsing them onto one line.
		 */
		const TEST_WEBVTT_TRACK = `WEBVTT

00:00:00.000 --> 00:00:20.000
Hello.
First, this lunchtime,`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const lineCount = await page
			.locator("captions-renderer > main > sub37-region .line-block")
			.count();

		expect(lineCount).toBe(2);
	});

	test("Default class colors should inject the correct color and background-color CSS values", async ({
		page,
		waitForEvent,
		seekToSecond,
		pauseServing,
	}) => {
		const TEST_WEBVTT_TRACK = `
WEBVTT

00:00:00.000 --> 00:00:20.000
<c.yellow>yellow text</c> <c.bg_blue>blue bg text</c>
`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const regionSpan = page.locator("captions-renderer > main > sub37-region span");

		const [textColor, bgColor] = await Promise.all([
			/*
			 * color is wrapped in var(--sub37-text-color, ...) by the renderer.
			 * When the CSS variable is unset, getComputedStyle resolves the fallback.
			 */
			regionSpan.locator("span.yellow > span").evaluate((el) => getComputedStyle(el).color),
			regionSpan
				.locator("span.bg_blue > span")
				.evaluate((el) => getComputedStyle(el).backgroundColor),
		]);

		expect(textColor).toBe("rgb(255, 255, 0)");
		expect(bgColor).toBe("rgb(0, 0, 255)");
	});

	test("A cue with timestamp-separated lines renders each word on its own line and keeps them within the region", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		/**
		 * Bare text after each timestamp (no closing tag before the next timestamp)
		 * means the \x0A is accumulated into currentCue.text before it is flushed.
		 * That makes splitCueNodeByBreakpoints assign different variation IDs to each
		 * sub-cue, so every word becomes its own p.line-block.
		 *
		 * At second 22, four sub-cues are active (16 s, 18 s, 20 s, 22 s) which
		 * produces four line blocks in a region whose default visible height is two
		 * lines.  The translateY scroll must shift the content up by exactly two
		 * line-heights so that the last two words remain visible — not by a multiple
		 * of the total scroll-root height, which would push everything out of the
		 * overflow:hidden clip.
		 */
		const TEST_WEBVTT_TRACK = `
WEBVTT

00:00:16.000 --> 00:00:24.000
<00:00:16.000>This
<00:00:18.000>can
<00:00:20.000>match
<00:00:22.000>:past/:future
<00:00:24.000>
`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(22);

		const lineBlocks = page.locator("captions-renderer > main > sub37-region p.line-block");
		expect(await lineBlocks.count()).toBe(4);

		const regionTop = await page
			.locator("captions-renderer > main > sub37-region")
			.evaluate((el) => el.getBoundingClientRect().top);

		const lastLineTop = await lineBlocks
			.last()
			.evaluate((el) => el.getBoundingClientRect().top);

		/*
		 * The last line must be at or below the top edge of the region.
		 * A broken translateY (multiplied by total scroll-root height instead
		 * of a single line height) would push all content above regionTop.
		 */
		expect(lastLineTop).toBeGreaterThanOrEqual(regionTop);
	});

	test("A STYLE block override for a class should take precedence over the default class color", async ({
		page,
		waitForEvent,
		seekToSecond,
		pauseServing,
	}) => {
		const TEST_WEBVTT_TRACK = `
WEBVTT

STYLE
::cue(.yellow) {
	color: cyan;
}

00:00:00.000 --> 00:00:20.000
<c.yellow>yellow text</c>
`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const regionSpan = page.locator("captions-renderer > main > sub37-region span");

		const textColor = await regionSpan
			.locator("span.yellow > span")
			.evaluate((el) => getComputedStyle(el).color);

		/*
		 * cyan = rgb(0, 255, 255). The STYLE block entity is placed after the
		 * default color entity in the array, so it wins via cssText append order.
		 */
		expect(textColor).toBe("rgb(0, 255, 255)");
	});

	/**
	 * The following tests assert that WebVTT cue settings (position, size, align)
	 * are reflected as geometry on `sub37-region` itself — not on an inner
	 * rendering-modifier div
	 */

	test("WebVTT cue with line-left position:30% size:50% should produce a region with width 50% and left 30%", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		const TEST_WEBVTT_TRACK = `WEBVTT

00:00:00.000 --> 00:00:20.000 position:30%,line-left size:50%
Hello`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const region = page.locator("captions-renderer > main > sub37-region");

		const [width, left] = await Promise.all([
			region.evaluate((el) => el.style.width),
			region.evaluate((el) => el.style.left),
		]);

		expect(width).toBe("50%");
		expect(left).toBe("30%");
	});

	test("WebVTT cue with center position:70% size:80% should produce a region with width 60% and left 40%", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		/*
		 * position=70 > 50, center alignment:
		 *   width    = min(size=80, (100-70)*2) = min(80, 60) = 60%
		 *   leftOffset = 100 - 60 = 40%
		 */
		const TEST_WEBVTT_TRACK = `WEBVTT

00:00:00.000 --> 00:00:20.000 position:70%,center size:80%
Hello`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const region = page.locator("captions-renderer > main > sub37-region");

		const [width, left] = await Promise.all([
			region.evaluate((el) => el.style.width),
			region.evaluate((el) => el.style.left),
		]);

		expect(width).toBe("60%");
		expect(left).toBe("40%");
	});

	test("WebVTT cue with align:right should produce a region with text-align right", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		/*
		 * align:right → auto position = 100, positionAlignment = line-right
		 * width = min(100, position=100) = 100%, leftOffset = 0%
		 * text-align comes from a LineStyleEntity on the cue, applied to p.line-block.
		 */
		const TEST_WEBVTT_TRACK = `WEBVTT

00:00:00.000 --> 00:00:20.000 align:right
Hello`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const lineBlock = page.locator("captions-renderer > main > sub37-region .line-block");
		const textAlign = await lineBlock.evaluate((el) => el.style.textAlign);

		expect(textAlign).toBe("right");
	});

	test("WebVTT cue with position:10%,line-left size:40% align:left should produce a region with width 40% and left 10%", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		/*
		 * positionAlignment=line-left (explicit), position=10, size=40
		 * width = min(40, 100-10) = min(40, 90) = 40%
		 * leftOffset = 10%
		 */
		const TEST_WEBVTT_TRACK = `WEBVTT

00:00:00.000 --> 00:00:20.000 position:10%,line-left size:40% align:left
Hello`;

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_WEBVTT_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const region = page.locator("captions-renderer > main > sub37-region");
		const lineBlock = page.locator("captions-renderer > main > sub37-region .line-block");

		const [width, left, textAlign] = await Promise.all([
			region.evaluate((el) => el.style.width),
			region.evaluate((el) => el.style.left),
			lineBlock.evaluate((el) => el.style.textAlign),
		]);

		expect(width).toBe("40%");
		expect(left).toBe("10%");
		expect(textAlign).toBe("left");
	});
}); // WebVTT

test.describe("TTML", () => {
	test("TTML cue with <br /> between two spans should render on two separate lines", async ({
		page,
		waitForEvent,
		pauseServing,
		seekToSecond,
	}) => {
		const TEST_TTML_TRACK = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttp="http://www.w3.org/ns/ttml#parameter"
    ttp:timeBase="media"
    xml:lang="">
  <body>
    <div>
      <p xml:id="subtitle1" begin="00:00:00.000" end="00:00:10.000">
        <span>Hello.</span>
        <br />
        <span>First, this lunchtime,</span>
      </p>
    </div>
  </body>
</tt>`;

		await page.getByRole("radio", { name: "TTML (application/ttml+xml)" }).click();

		await Promise.all([
			waitForEvent("playing"),
			page.getByRole("textbox", { name: "WEBVTT..." }).fill(TEST_TTML_TRACK),
		]);

		await pauseServing();
		await seekToSecond(3);

		const lineCount = await page
			.locator("captions-renderer > main > sub37-region .line-block")
			.count();

		expect(lineCount).toBe(2);
	});
}); // TTML
