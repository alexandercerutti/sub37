// @ts-check
import { describe, it, expect } from "@jest/globals";
import { parseCue, parseRegion, parseStyle } from "../lib/Parser/index.js";

describe("Parser", () => {
	describe("parseCue", () => {
		const TEST_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:25.000 region:fred align:left
<v Fred&gt;>Would you like to get &lt; coffee?

00:00:00.000 --> 00:00:20.000 region:fred align:left
<lang.mimmo en-US>Hi, my name is Fred</lang>

00:00:16.000 --> 00:00:24.000
<00:00:16.000> <c.mimmo>This</c>
<00:00:18.000> <c>can</c>
<00:00:20.000> <c>match</c>
<00:00:22.000> <c>:past/:future</c>
<00:00:24.000>
`;

		it("should convert a CueData to a CueNode", () => {
			expect(
				parseCue({
					attributes: "region:fred align:left",
					cueid: "cue-105-207",
					starttime: "00:00:05.000",
					endtime: "00:00:25.000",
					text: "<v Fred&gt;>Would you like to get &lt; coffee?",
				}),
			).toEqual([
				{
					id: "cue-105-207",
					startTime: 5000,
					endTime: 25000,
					content: "Would you like to get < coffee?",
					entities: [
						{
							offset: 0,
							length: 31,
							attributes: ["Fred>"],
							tagType: 1,
							type: 1,
						},
					],
					attributes: {
						region: "fred",
						align: "left",
					},
				},
			]);
		});

		it("should return an array of CueNodes if a CueData inclues timestamps. All the CueNodes should maintain the same origin ID", () => {
			/** @type {import("../lib/Parser/index.js").CueRawData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:27.000",
				text: `Welcome Liquicity Airlines
<00:00:06.000> Our destination: the galaxy of dreams
<00:00:09.000> (Our destination: the galaxy of dreams)
<00:00:12.000> Estimated Time of Arrival: unknown
<00:00:18.000> Please fasten your seatbelt
<00:00:21.000> And get ready to take off
<00:00:24.000> (Please fasten your seatbelt)
<00:00:27.000> (And get ready to take off)
`,
			};

			const parsingResult = parseCue(originalData);

			expect(parsingResult.length).toBe(8);

			expect(parsingResult[0]).toEqual({
				id: "text-1",
				startTime: 0,
				endTime: 27000,
				content: "Welcome Liquicity Airlines\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[1]).toEqual({
				id: "text-1",
				startTime: 6000,
				endTime: 27000,
				content: " Our destination: the galaxy of dreams\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[2]).toEqual({
				id: "text-1",
				startTime: 9000,
				endTime: 27000,
				content: " (Our destination: the galaxy of dreams)\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[3]).toEqual({
				id: "text-1",
				startTime: 12000,
				endTime: 27000,
				content: " Estimated Time of Arrival: unknown\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[4]).toEqual({
				id: "text-1",
				startTime: 18000,
				endTime: 27000,
				content: " Please fasten your seatbelt\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[5]).toEqual({
				id: "text-1",
				startTime: 21000,
				endTime: 27000,
				content: " And get ready to take off\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[6]).toEqual({
				id: "text-1",
				startTime: 24000,
				endTime: 27000,
				content: " (Please fasten your seatbelt)\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[7]).toEqual({
				id: "text-1",
				startTime: 27000,
				endTime: 27000,
				content: " (And get ready to take off)\n",
				entities: [],
				attributes: {},
			});
		});

		it("should return an array of CueNodes with the same id and endTime if one cue is passed", () => {
			/** @type {import("../lib/Parser/index.js").CueRawData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:16.000",
				text: `Welcome to the galaxy of dreams`,
			};

			const parsingResult = parseCue(originalData);

			expect(parsingResult.length).toBe(1);

			expect(parsingResult[0]).toEqual({
				id: "text-1",
				startTime: 0,
				endTime: 16000,
				content: "Welcome to the galaxy of dreams",
				entities: [],
				attributes: {},
			});
		});

		it("should return an array of CueNodes that have the same entities if an entity start before a timestamp and ends in a next timestamp", () => {
			/** @type {import("../lib/Parser/index.js").CueRawData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:30.000",
				text: `<v Announcer>Welcome Liquicity Airlines
<00:00:06.000> Our destination: the galaxy of dreams
<00:00:09.000> (Our destination: the galaxy of dreams)</v>
<v Announcer2><00:00:12.000> Estimated Time of Arrival: unknown
<00:00:18.000> Please fasten your seatbelt</v>
<00:00:21.000> <v Announcer3>And get ready to take off
<00:00:24.000> (Please fasten your seatbelt)</v>
<00:00:27.000> (And get ready to take off)
`,
			};

			const parsingResult = parseCue(originalData);
			expect(parsingResult.length).toBe(8);

			expect(parsingResult[0].entities).toEqual([
				{
					offset: 0,
					length: 27,
					attributes: ["Announcer"],
					tagType: 1,
					type: 1,
				},
			]);

			expect(parsingResult[1].entities).toEqual([
				{
					offset: 0,
					length: 39,
					attributes: ["Announcer"],
					tagType: 1,
					type: 1,
				},
			]);

			expect(parsingResult[2].entities).toEqual([
				{
					offset: 0,
					length: 40,
					attributes: ["Announcer"],
					tagType: 1,
					type: 1,
				},
			]);

			expect(parsingResult[3].entities).toEqual([
				{
					offset: 0,
					length: 36,
					attributes: ["Announcer2"],
					tagType: 1,
					type: 1,
				},
			]);

			expect(parsingResult[4].entities).toEqual([
				{
					offset: 0,
					length: 28,
					attributes: ["Announcer2"],
					tagType: 1,
					type: 1,
				},
			]);

			expect(parsingResult[5].entities).toEqual([
				{
					offset: 1,
					length: 26,
					attributes: ["Announcer3"],
					tagType: 1,
					type: 1,
				},
			]);

			expect(parsingResult[7].entities).toEqual([]);
		});
	});

	describe("parseRegion", () => {
		const REGION_WITH_ATTRIBUTES_NEWLINES = `id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up
`;

		const REGION_WITH_ATTRIBUTES_SPACES = `id:fred width:40% lines:3 regionanchor:0%,100% viewportanchor:10%,90% scroll:up`;

		const REGION_WITHOUT_ID = `width:40% lines:3 regionanchor:0%,100% viewportanchor:10%,90% scroll:up`;

		it("should return a custom region with converted attributes if string is separated by newlines", () => {
			expect(parseRegion(REGION_WITH_ATTRIBUTES_NEWLINES)).toEqual({
				id: "fred",
				width: "40%",
				lines: 3,
				displayStrategy: "push",
				origin: ["10%", "90%"],
			});
		});

		it("should return a custom region with converted attributes if string is separated by spaces", () => {
			expect(parseRegion(REGION_WITH_ATTRIBUTES_SPACES)).toEqual({
				id: "fred",
				width: "40%",
				lines: 3,
				displayStrategy: "push",
				origin: ["10%", "90%"],
			});
		});

		it("should discard the parsing result if a text region misses the id", () => {
			expect(parseRegion(REGION_WITHOUT_ID)).toBeUndefined();
		});
	});

	describe("parseStyle", () => {
		it("should return undefined if style block is invalid", () => {
			const STYLE_INVALID = `/** ::cue { }`;
			expect(parseStyle(STYLE_INVALID)).toBeUndefined();
		});

		it("should safely ignore css comments", () => {
			const STYLE_GLOBAL_WITH_COMMENT_TOP = `
/* This is a top comment */
::cue {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_GLOBAL_WITH_COMMENT_TOP)).toEqual({
				type: 0,
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});

			const STYLE_GLOBAL_WITH_COMMENT_MIDDLE = `
::cue {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	/* This is a middle comment */
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_GLOBAL_WITH_COMMENT_MIDDLE)).toEqual({
				type: 0,
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});

			const STYLE_GLOBAL_WITH_END_COMMENT = `
::cue {
background-image: linear-gradient(to bottom, dimgray, lightgray);
color: papayawhip;
}
/* This is an end comment */
		`;

			expect(parseStyle(STYLE_GLOBAL_WITH_END_COMMENT)).toEqual({
				type: 0,
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});
		});

		it("should return a structure containing global styles if style block has no selector", () => {
			const STYLE_GLOBAL = `
::cue {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_GLOBAL)).toEqual({
				type: 0,
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});
		});

		it("should return a structure containing the id if the style block has an id", () => {
			const STYLE_WITH_STRING_ID = `
::cue(#test) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_STRING_ID)).toEqual({
				type: 1,
				selector: "test",
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});

			/**
			 * Scripts run in "strict-mode" and in there octal identifiers are not allowed.
			 * Octal identifiers are also not allowed in template strings. Hence, we are
			 * double-escaping them. Node.js double escapes them when they are read as buffers,
			 *
			 * @see https://www.w3.org/International/questions/qa-escapes#css_identifiers
			 * @see https://github.com/chromium/chromium/blob/924ec189cdfd33c8cee15d918f927afcb88d06db/third_party/blink/renderer/core/css/parser/css_parser_idioms.cc#L24-L52
			 */

			const STYLE_WITH_NUMERIC_ID = `
::cue(#\\31 23) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_NUMERIC_ID)).toEqual({
				type: 1,
				selector: "123",
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});
		});

		it("should return a structure containing an escaped id if the style block has an id with spaces", () => {
			const STYLE_WITH_ID_ESCAPED = `
::cue(#crédit\ de\ transcription) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_ID_ESCAPED)).toEqual({
				type: 1,
				selector: "crédit de transcription",
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
			});
		});

		it("should return a structure containing the selector if the style block has one", () => {
			const STYLE_WITH_SELECTOR_NO_ATTRIBUTES = `
::cue(b) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_SELECTOR_NO_ATTRIBUTES)).toEqual({
				type: 2,
				selector: "b",
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
				attributes: [],
			});
		});

		it("should return a structure containing the selector and the attributes if style block has some", () => {
			const STYLE_WITH_SELECTOR_ONE_ATTRIBUTE = `
::cue(v[voice="Esme"]) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_SELECTOR_ONE_ATTRIBUTE)).toEqual({
				type: 2,
				selector: "v",
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
				attributes: [["voice", "Esme"]],
			});

			const STYLE_WITH_SELECTOR_ATTRIBUTES = `
::cue(v[voice="Esme"][lang="it"]) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_SELECTOR_ATTRIBUTES)).toEqual({
				type: 2,
				selector: "v",
				styleString:
					"background-image: linear-gradient(to bottom, dimgray, lightgray); color: papayawhip;",
				attributes: [
					["voice", "Esme"],
					["lang", "it"],
				],
			});
		});
	});
});
