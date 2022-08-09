// @ts-check
import { describe, beforeEach, it, expect } from "@jest/globals";
import WebVTTRenderer from "../lib/Renderer.js";

describe("WebVTTRenderer", () => {
	/** @type {WebVTTRenderer} */
	let renderer;

	beforeEach(() => {
		renderer = new WebVTTRenderer();
	});

	it("should always return a supported type", () => {
		expect(WebVTTRenderer.supportedType).toEqual("text/vtt");
	});

	describe("parse", () => {
		const CLASSIC_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:25.000 region:fred align:left
<v Fred&gt;>Would you like to get &lt; coffee?

00:00:00.000 --> 00:00:20.000 region:fred align:left
<lang.mimmo en-US>Hi, my name is Fred</lang>`;

		const SAME_START_END_TIMES_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:05.000
This cue should never appear, right?

00:00:06.000 --> 00:00:07.000
...

00:00:08.000 --> 00:00:10.000
...Right?
`;

		const REGION_WITH_ATTRIBUTES = `
WEBVTT

REGION
id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up

00:00:05.000 --> 00:00:10.000 region:fred
Mamma mia, Marcello, that's not how you hold a gun.
Alberto, come to look at Marcello!
`;

		it("should return an empty array if rawContent is falsy", () => {
			// @ts-expect-error
			expect(renderer.parse(undefined)).toEqual([]);
			// @ts-expect-error
			expect(renderer.parse(null)).toEqual([]);
			expect(renderer.parse("")).toEqual([]);
		});

		it("should throw if it receives a string that does not start with 'WEBTT' header", () => {
			const invalidWebVTTError = "Invalid WebVTT file. It should start with string 'WEBVTT'";
			// @ts-expect-error
			expect(() => renderer.parse(true)).toThrow(Error, invalidWebVTTError);
			// @ts-expect-error
			expect(() => renderer.parse(10)).toThrow(Error /*invalidWebVTTError*/);
			expect(() => renderer.parse("Look, a phoenix!")).toThrow(Error /*invalidWebVTTError*/);
		});

		it("should exclude cues with the same start time and end time", () => {
			const result = renderer.parse(SAME_START_END_TIMES_CONTENT);
			expect(result.length).toEqual(2);

			expect(result[0].startTime).toEqual(6000);
			expect(result[0].endTime).toEqual(7000);

			expect(result[1].startTime).toEqual(8000);
			expect(result[1].endTime).toEqual(10000);
		});

		it("should return an array containing two cues", () => {
			const parsingResult = renderer.parse(CLASSIC_CONTENT);
			expect(parsingResult).toBeInstanceOf(Array);
			expect(parsingResult.length).toEqual(2);

			expect(parsingResult[0]).toEqual({
				startTime: 5000,
				endTime: 25000,
				content: "Would you like to get < coffee?",
				id: "cue-9-108",
				attributes: {
					align: "left",
					region: "fred",
				},
				entities: [
					{
						offset: 0,
						length: 31,
						tagType: 1,
						type: 1,
						attributes: ["Fred>"],
						/** @TODO add classes */
					},
				],
			});

			expect(parsingResult[1]).toEqual({
				startTime: 0,
				endTime: 20000,
				content: "Hi, my name is Fred",
				id: "cue-110-207",
				attributes: {
					region: "fred",
					align: "left",
				},
				entities: [
					{
						offset: 0,
						length: 19,
						tagType: 2,
						type: 1, // lang
						attributes: ["en-US"],
						/** @TODO add classes */
					},
				],
			});
		});

		it("should return an array containing four cues when a timestamps are found", () => {
			const TIMESTAMPS_CUES_CONTENT = `
WEBVTT

00:00:16.000 --> 00:00:24.000
<00:00:16.000> <c.mimmo>This</c>
<00:00:18.000> <c>can</c>
<00:00:20.000> <c>match</c>
<00:00:22.000> <c>:past/:future</c>
<00:00:24.000>
			`;

			const parsingResult = renderer.parse(TIMESTAMPS_CUES_CONTENT);
			expect(parsingResult).toBeInstanceOf(Array);
			expect(parsingResult.length).toEqual(4);

			expect(parsingResult[0]).toEqual({
				startTime: 16000,
				endTime: 24000,
				content: " This\n",
				id: "cue-9-180",
				attributes: {},
				entities: [
					{
						tagType: 16,
						type: 1,
						offset: 1,
						length: 4,
						attributes: [],
					},
				],
			});

			expect(parsingResult[1]).toEqual({
				startTime: 18000,
				endTime: 24000,
				content: " can\n",
				id: "cue-9-180",
				attributes: {},
				entities: [
					{
						tagType: 16,
						type: 1,
						offset: 1,
						length: 3,
						attributes: [],
					},
				],
			});
		});

		it("should return a cue with three entities when ruby autocloses a ruby-text <rt>", () => {
			const RUBY_RT_AUTOCLOSE = `
WEBVTT

00:00:05.000 --> 00:00:10.000
<ruby>漢 <rt>kan</rt> 字 <rt>ji</ruby>
			`;

			debugger;

			const parsingResult = renderer.parse(RUBY_RT_AUTOCLOSE);
			expect(parsingResult).toBeInstanceOf(Array);
			expect(parsingResult.length).toEqual(1);

			expect(parsingResult[0]).toEqual({
				startTime: 5000,
				endTime: 10000,
				content: "漢 kan 字 ji\n",
				id: "cue-9-79",
				attributes: {},
				entities: [
					{
						tagType: 8,
						type: 1,
						offset: 2,
						length: 3,
						attributes: [],
					},
					{
						tagType: 8,
						type: 1,
						offset: 8,
						length: 2,
						attributes: [],
					},
					{
						tagType: 4,
						type: 1,
						offset: 0,
						length: 10,
						attributes: [],
					},
				],
			});
		});

		it("should return a cue with a region associated", () => {
			const parsingResult = renderer.parse(REGION_WITH_ATTRIBUTES);

			expect(parsingResult[0]).toEqual({
				content:
					"Mamma mia, Marcello, that's not how you hold a gun.\n" +
					"Alberto, come to look at Marcello!\n",
				startTime: 5000,
				endTime: 10000,
				entities: [],
				id: "cue-97-226",
				attributes: {
					region: "fred",
				},
				region: {
					id: "fred",
					width: "40%",
					lines: 3,
					origin: ["10%", "90%"],
					displayStrategy: "push",
				},
			});
		});

		describe("styles", () => {
			describe("should correctly convert styles to entities and apply them to cues", () => {
				it("should add global style", () => {
					const CUE_WITH_STYLE_WITHOUT_ID = `
WEBVTT

STYLE
::cue {
	background-color: purple;
}

00:00:05.000 --> 00:00:10.000 region:fred
Mamma mia, Marcello, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult = renderer.parse(CUE_WITH_STYLE_WITHOUT_ID);

					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\n" +
						"Alberto, come to look at Marcello!\n";

					expect(parsingResult[0]).toEqual({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							{
								type: 0,
								reason: "global",
								styles: "background-color: purple;",
								offset: 0,
								length:
									"Mamma mia, Marcello, that's not how you hold a gun.\n".length +
									"Alberto, come to look at Marcello!\n".length,
							},
						],
						id: "cue-53-187",
						attributes: {
							region: "fred",
						},
					});
				});

				it("should add only style that matches the id", () => {
					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\n" +
						"Alberto, come to look at Marcello!\n";

					const CUE_WITH_STYLE_WITH_CSS_ID = `
WEBVTT

STYLE
::cue(#test) {
	background-color: purple;
}

STYLE
::cue(#\\31 23) {
	background-color: red;
}

test
00:00:05.000 --> 00:00:10.000 region:fred
Mamma mia, Marcello, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult1 = renderer.parse(CUE_WITH_STYLE_WITH_CSS_ID);

					expect(parsingResult1[0]).toEqual({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							{
								type: 0,
								reason: "id-match",
								styles: "background-color: purple;",
								offset: 0,
								length:
									"Mamma mia, Marcello, that's not how you hold a gun.\n".length +
									"Alberto, come to look at Marcello!\n".length,
							},
						],
						id: "test",
						attributes: {
							region: "fred",
						},
					});

					const CUE_WITH_STYLE_WITH_ESCAPED_ID = `
WEBVTT

STYLE
::cue(#test) {
	background-color: purple;
}

STYLE
::cue(#\\31 23) {
	background-color: red;
}

123
00:00:05.000 --> 00:00:10.000 region:fred
Mamma mia, Marcello, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult2 = renderer.parse(CUE_WITH_STYLE_WITH_ESCAPED_ID);

					expect(parsingResult2[0]).toEqual({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							{
								type: 0,
								reason: "id-match",
								styles: "background-color: red;",
								offset: 0,
								length:
									"Mamma mia, Marcello, that's not how you hold a gun.\n".length +
									"Alberto, come to look at Marcello!\n".length,
							},
						],
						id: "123",
						attributes: {
							region: "fred",
						},
					});
				});

				it("should add only style that matches the tag", () => {
					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\n" +
						"Alberto, come to look at Marcello!\n";

					const CUE_WITH_STYLE_WITH_CSS_TAG = `
WEBVTT

STYLE
::cue(b) {
	background-color: purple;
}

STYLE
::cue(ruby) {
	background-color: red;
}

00:00:05.000 --> 00:00:10.000 region:fred
<b>Mamma mia, Marcello</b>, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult1 = renderer.parse(CUE_WITH_STYLE_WITH_CSS_TAG);

					expect(parsingResult1[0]).toEqual({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							{
								type: 1,
								tagType: 32,
								offset: 0,
								length: 19,
								attributes: [],
							},
							{
								type: 0,
								styles: "background-color: purple;",
								offset: 0,
								length: 19,
							},
						],
						id: "cue-103-244",
						attributes: {
							region: "fred",
						},
					});
				});

				it("should apply all styles and tags", () => {
					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\n" +
						"Alberto, come to look at Marcello!\n";

					const CUE_WITH_STYLE_WITH_CSS_TAG = `
WEBVTT

STYLE
::cue(b) {
	background-color: purple;
}

STYLE
::cue(#test) {
	background-color: red;
}

test
00:00:05.000 --> 00:00:10.000 region:fred
<b>Mamma mia, Marcello</b>, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult1 = renderer.parse(CUE_WITH_STYLE_WITH_CSS_TAG);

					expect(parsingResult1[0]).toEqual({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							{
								type: 0,
								styles: "background-color: red;",
								reason: "id-match",
								offset: 0,
								length: content.length,
							},
							{
								type: 1,
								tagType: 32,
								offset: 0,
								length: 19,
								attributes: [],
							},
							{
								type: 0,
								styles: "background-color: purple;",
								reason: "in-tag",
								offset: 0,
								length: 19,
							},
						],
						id: "test",
						attributes: {
							region: "fred",
						},
					});
				});
			});
		});
	});
});
