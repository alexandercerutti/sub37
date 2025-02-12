// @ts-check
import { describe, it, expect } from "@jest/globals";
import { parseCue, parseRegion, parseStyle } from "../lib/Parser/index.js";
import { WebVTTRenderingModifiers } from "../lib/Parser/RenderingModifiers.js";
import { InvalidStyleDeclarationError } from "../lib/InvalidStyleDeclarationError.js";
import { MalformedStyleBlockError } from "../lib/MalformedStyleBlockError.js";

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

		it("should convert a CueData to a CueParsedData", () => {
			expect(
				parseCue({
					attributes: "region:fred align:left",
					cueid: "cue-105-207",
					starttime: "00:00:05.000",
					endtime: "00:00:25.000",
					text: "<v Fred&gt;>Would you like to get &lt; coffee?",
				}),
			).toMatchObject([
				{
					id: "cue-105-207",
					startTime: 5000,
					endTime: 25000,
					text: "Would you like to get < coffee?",
					tags: [
						{
							type: 1,
							offset: 0,
							length: 31,
							attributes: new Map([["voice", "Fred>"]]),
							tagType: 1,
						},
					],
					/**
					 * @type {import("@sub37/server").RenderingModifiers}
					 */
					renderingModifiers: {
						id: 98,
						leftOffset: 0,
						textAlignment: "left",
						width: 100,
						regionIdentifier: "fred",
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

			expect(parsingResult[0]).toMatchObject({
				id: "text-1",
				startTime: 0,
				endTime: 27000,
				text: "Welcome Liquicity Airlines\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[1]).toMatchObject({
				id: "text-1",
				startTime: 6000,
				endTime: 27000,
				text: " Our destination: the galaxy of dreams\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[2]).toMatchObject({
				id: "text-1",
				startTime: 9000,
				endTime: 27000,
				text: " (Our destination: the galaxy of dreams)\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[3]).toMatchObject({
				id: "text-1",
				startTime: 12000,
				endTime: 27000,
				text: " Estimated Time of Arrival: unknown\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[4]).toMatchObject({
				id: "text-1",
				startTime: 18000,
				endTime: 27000,
				text: " Please fasten your seatbelt\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[5]).toMatchObject({
				id: "text-1",
				startTime: 21000,
				endTime: 27000,
				text: " And get ready to take off\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[6]).toMatchObject({
				id: "text-1",
				startTime: 24000,
				endTime: 27000,
				text: " (Please fasten your seatbelt)\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
			});

			expect(parsingResult[7]).toMatchObject({
				id: "text-1",
				startTime: 27000,
				endTime: 27000,
				text: " (And get ready to take off)\n",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
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

			expect(parsingResult[0]).toMatchObject({
				id: "text-1",
				startTime: 0,
				endTime: 16000,
				text: "Welcome to the galaxy of dreams",
				tags: [],
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					leftOffset: 0,
					textAlignment: "center",
					width: 100,
					regionIdentifier: undefined,
				},
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

			expect(parsingResult[0].tags).toMatchObject([
				{
					type: 1,
					tagType: 1,
					offset: 0,
					length: 27,
					attributes: new Map([["voice", "Announcer"]]),
				},
			]);

			expect(parsingResult[1].tags).toMatchObject([
				{
					type: 1,
					tagType: 1,
					offset: 0,
					length: 39,
					attributes: new Map([["voice", "Announcer"]]),
				},
			]);

			expect(parsingResult[2].tags).toMatchObject([
				{
					type: 1,
					tagType: 1,
					offset: 0,
					length: 40,
					attributes: new Map([["voice", "Announcer"]]),
				},
			]);

			expect(parsingResult[3].tags).toMatchObject([
				{
					type: 1,
					tagType: 1,
					offset: 0,
					length: 36,
					attributes: new Map([["voice", "Announcer2"]]),
				},
			]);

			expect(parsingResult[4].tags).toMatchObject([
				{
					type: 1,
					tagType: 1,
					offset: 0,
					length: 28,
					attributes: new Map([["voice", "Announcer2"]]),
				},
			]);

			expect(parsingResult[5].tags).toMatchObject([
				{
					type: 1,
					tagType: 1,
					offset: 1,
					length: 26,
					attributes: new Map([["voice", "Announcer3"]]),
				},
			]);

			expect(parsingResult[7].tags).toMatchObject([]);
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
			expect(parseRegion(REGION_WITH_ATTRIBUTES_NEWLINES)).toMatchObject({
				id: "fred",
				width: 40,
				lines: 3,
			});
		});

		it("should return a custom region with converted attributes if string is separated by spaces", () => {
			expect(parseRegion(REGION_WITH_ATTRIBUTES_SPACES)).toMatchObject({
				id: "fred",
				width: 40,
				lines: 3,
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

		it("should return undefined if the style block is empty", () => {
			const EMPTY_STYLE_BLOCK_1 = `
				::cue {
				
				}
			`;

			const EMPTY_STYLE_BLOCK_2 = `
				::cue(#test) {
				
				}
			`;

			expect(parseStyle(EMPTY_STYLE_BLOCK_1)).toBeUndefined();
			expect(parseStyle(EMPTY_STYLE_BLOCK_2)).toBeUndefined();
		});

		it("should throw if style block is malformed", () => {
			const STYLE_INVALID = `::cue (te {
			
			}`;

			expect(() => parseStyle(STYLE_INVALID)).toThrow(new InvalidStyleDeclarationError());
		});

		it("should throw if style block contains an empty line", () => {
			const STYLE_INVALID = `::cue (#test) {
			
			}`;

			expect(() => parseStyle(STYLE_INVALID)).toThrow(new InvalidStyleDeclarationError());
		});

		it("should throw if parsing failed", () => {
			expect(() => parseStyle("")).toThrow(new MalformedStyleBlockError());
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
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
				tagName: 32,
				styleString:
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
				attributes: new Map(),
				classes: [],
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
				tagName: 1,
				styleString:
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
				attributes: new Map([["voice", "Esme"]]),
				classes: [],
			});

			const STYLE_WITH_SELECTOR_ATTRIBUTES = `
::cue(v[voice="Esme"][lang="it"]) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_SELECTOR_ATTRIBUTES)).toEqual({
				type: 2,
				tagName: 1,
				styleString:
					"background-image:linear-gradient(to bottom, dimgray, lightgray);color:papayawhip;",
				attributes: new Map([
					["voice", "Esme"],
					["lang", "it"],
				]),
				classes: [],
			});
		});

		it("should safely ignore style if a ruleset contains an unrecognized tag as selector", () => {
			const STYLE_WITH_INVALID_TAG = `
::cue(m) {
	background-image: linear-gradient(to bottom, dimgray, lightgray);
	color: papayawhip;
}
			`;

			expect(parseStyle(STYLE_WITH_INVALID_TAG)).toBeUndefined();
		});

		it("should filter out unsupported css properties", () => {
			const STYLE_STRING_WITH_SOME_INVALID_PROPS = `
::cue {
	background-color: blue;
	font-decoration: chihuahua (?);
	color: papayawhip;
}
`;

			expect(parseStyle(STYLE_STRING_WITH_SOME_INVALID_PROPS)).toEqual({
				type: 0,
				styleString: "background-color:blue;color:papayawhip;",
			});

			debugger;
		});

		it("should return undefined if no supported properties is found", () => {
			const STYLE_STRING_WITH_INVALID_PROPS = `
::cue {
	font-decoration: chihuahua (?);
}
`;

			expect(parseStyle(STYLE_STRING_WITH_INVALID_PROPS)).toBeUndefined();
		});
	});

	describe("RenderingModifiers", () => {
		it("should return default values if no attributes string is provided", () => {
			const modifier1 = WebVTTRenderingModifiers.fromString("");

			expect(modifier1.leftOffset).toBe(0);
			expect(modifier1.regionIdentifier).toBeUndefined();
			expect(modifier1.textAlignment).toBe("center");
			expect(modifier1.width).toBe(100);

			const modifier2 = new WebVTTRenderingModifiers();

			expect(modifier2.leftOffset).toBe(0);
			expect(modifier2.regionIdentifier).toBeUndefined();
			expect(modifier2.textAlignment).toBe("center");
			expect(modifier2.width).toBe(100);
		});
	});
});
