// @ts-check
import { Entities, CueNode, BaseAdapter } from "@sub37/server";
import { ParseResult } from "@sub37/server/lib/BaseAdapter/index.js";
import { describe, beforeEach, it, expect } from "@jest/globals";
import WebVTTAdapter from "../lib/Adapter.js";
import { MissingContentError } from "../lib/MissingContentError.js";
import { InvalidFormatError } from "../lib/InvalidFormatError.js";

describe("WebVTTAdapter", () => {
	/** @type {WebVTTAdapter} */
	let adapter;

	beforeEach(() => {
		adapter = new WebVTTAdapter();
	});

	it("should always return a supported type", () => {
		expect(WebVTTAdapter.supportedType).toEqual("text/vtt");
	});

	describe("parse", () => {
		it("should return an empty ParseResult if rawContent is falsy", () => {
			const emptyParseResult = BaseAdapter.ParseResult(
				[],
				[
					{
						error: new MissingContentError(),
						failedChunk: "",
						isCritical: true,
					},
				],
			);

			// @ts-expect-error
			expect(adapter.parse(undefined)).toEqual(emptyParseResult);
			// @ts-expect-error
			expect(adapter.parse(null)).toEqual(emptyParseResult);
			expect(adapter.parse("")).toEqual(emptyParseResult);
		});

		it("should throw if it receives a string that does not start with 'WEBTT' header", () => {
			// @ts-expect-error
			expect(adapter.parse(true)).toBeInstanceOf(ParseResult);
			// @ts-expect-error
			expect(adapter.parse(true).data.length).toBe(0);
			// @ts-expect-error
			expect(adapter.parse(true).errors.length).toBe(1);
			// @ts-expect-error
			expect(adapter.parse(true).errors[0].error).toEqual(
				new InvalidFormatError("WEBVTT_HEADER_MISSING", "true"),
			);
			// @ts-expect-error
			expect(adapter.parse(true).errors[0].isCritical).toBe(true);

			// @ts-expect-error
			expect(adapter.parse(10).errors[0].error).toEqual(
				new InvalidFormatError("WEBVTT_HEADER_MISSING", "true"),
			);
			expect(adapter.parse("Look, a phoenix!").errors[0].error).toEqual(
				new InvalidFormatError("WEBVTT_HEADER_MISSING", "true"),
			);
		});

		it("should be parsing all the content, from the first character to the last", () => {
			const GENERIC_RAW_VTT_CONTENT = `
WEBVTT

00:00:01.000 --> 00:00:04.000
Never drink liquid nitrogen.

00:00:05.000 --> 00:00:09.000
— It will perforate your stomach.
— You could die.

00:00:10.000 --> 00:00:14.000
The Organisation for Sample Public Service Announcements accepts no liability for the content of this advertisement, or for the consequences of any actions taken on the basis of the information provided.`;

			const parseResult = adapter.parse(GENERIC_RAW_VTT_CONTENT);

			expect(parseResult.data[2]).toBeTruthy();
			expect(parseResult.data[2].content).toBe(
				"The Organisation for Sample Public Service Announcements accepts no liability for the content of this advertisement, or for the consequences of any actions taken on the basis of the information provided.",
			);
		});

		it("should accept cues with minutes as most significant unit", () => {
			const GENERIC_RAW_VTT_CONTENT = `
WEBVTT

00:01.000 --> 00:04.000
Never drink liquid nitrogen.

NOTE EndTime is on purpose with hours. This test should also allow mixed units between start time and end time

10:05.000 --> 00:11:09.000
— It will perforate your stomach.
— You could die.`;

			const parseResult = adapter.parse(GENERIC_RAW_VTT_CONTENT);

			expect(parseResult.data.length).toBe(2);
			expect(parseResult.data[0].startTime).toBe(1000);
			expect(parseResult.data[0].endTime).toBe(4000);
			expect(parseResult.data[1].startTime).toBe(605000);
			expect(parseResult.data[1].endTime).toBe(669000);
		});

		it("should exclude cues with the same start time and end time", () => {
			const SAME_START_END_TIMES_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:05.000
This cue should never appear, right?

00:00:06.000 --> 00:00:07.000
...

00:00:08.000 --> 00:00:10.000
...Right?
`;

			const result = adapter.parse(SAME_START_END_TIMES_CONTENT);
			expect(result.data.length).toEqual(2);

			expect(result.data[0].startTime).toEqual(6000);
			expect(result.data[0].endTime).toEqual(7000);

			expect(result.data[1].startTime).toEqual(8000);
			expect(result.data[1].endTime).toEqual(10000);
		});

		it("should return an array containing two cues", () => {
			const CLASSIC_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:25.000 region:fred align:left
<v Fred&gt;>Would you like to get &lt; coffee?

00:00:00.000 --> 00:00:20.000 region:fred align:left
<lang.mimmo en-US>Hi, my name is Fred</lang>`;

			const parsingResult = adapter.parse(CLASSIC_CONTENT);
			expect(parsingResult).toBeInstanceOf(ParseResult);
			expect(parsingResult.data.length).toEqual(2);

			expect(parsingResult.data[0]).toMatchObject({
				startTime: 5000,
				endTime: 25000,
				content: "Would you like to get < coffee?",
				id: "cue-9-108",

				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 98,
					regionIdentifier: "fred",
					textAlignment: "left",
					width: 100,
					leftOffset: 0,
				},

				entities: [
					new Entities.Tag({
						tagType: 1,
						attributes: new Map([["voice", "Fred>"]]),
						classes: [],
					}),
				],
			});

			expect(parsingResult.data[1]).toMatchObject({
				startTime: 0,
				endTime: 20000,
				content: "Hi, my name is Fred",
				id: "cue-110-207",

				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 98,
					regionIdentifier: "fred",
					textAlignment: "left",
					width: 100,
					leftOffset: 0,
				},

				entities: [
					new Entities.Tag({
						tagType: 2,
						attributes: new Map([["lang", "en-US"]]),
						classes: ["mimmo"],
					}),
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

			const parsingResult = adapter.parse(TIMESTAMPS_CUES_CONTENT);
			expect(parsingResult).toBeInstanceOf(ParseResult);
			expect(parsingResult.data.length).toEqual(4);

			expect(parsingResult.data[0]).toMatchObject({
				startTime: 16000,
				endTime: 24000,
				content: "This",
				id: "cue-9-180",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: undefined,
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				entities: [
					new Entities.Tag({
						tagType: 16,
						attributes: new Map(),
						classes: ["mimmo"],
					}),
				],
			});

			expect(parsingResult.data[1]).toMatchObject({
				startTime: 18000,
				endTime: 24000,
				content: "can",
				id: "cue-9-180",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: undefined,
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				entities: [
					new Entities.Tag({
						tagType: 16,
						attributes: new Map(),
						classes: [],
					}),
				],
			});
		});

		it("should return a cue with three entities when ruby autocloses a ruby-text <rt>", () => {
			const RUBY_RT_AUTOCLOSE = `
WEBVTT

00:00:05.000 --> 00:00:10.000
<ruby>漢 <rt>kan</rt> 字 <rt>ji</ruby>
			`;

			const parsingResult = adapter.parse(RUBY_RT_AUTOCLOSE);
			expect(parsingResult).toBeInstanceOf(ParseResult);
			expect(parsingResult.data.length).toEqual(4);

			expect(parsingResult.data[0]).toMatchObject({
				startTime: 5000,
				endTime: 10000,
				content: "漢 ",
				id: "cue-9-79",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: undefined,
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				entities: [
					new Entities.Tag({
						tagType: Entities.TagType.RUBY,
						attributes: new Map(),
						classes: [],
						styles: {},
					}),
				],
			});

			expect(parsingResult.data[1]).toMatchObject({
				startTime: 5000,
				endTime: 10000,
				content: "kan",
				id: "cue-9-79",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: undefined,
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				entities: [
					new Entities.Tag({
						tagType: Entities.TagType.RUBY,
						attributes: new Map(),
						classes: [],
						styles: {},
					}),
					new Entities.Tag({
						tagType: Entities.TagType.RT,
						attributes: new Map(),
						classes: [],
						styles: {},
					}),
				],
			});
			expect(parsingResult.data[2]).toMatchObject({
				startTime: 5000,
				endTime: 10000,
				content: " 字 ",
				id: "cue-9-79",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: undefined,
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				entities: [
					new Entities.Tag({
						tagType: Entities.TagType.RUBY,
						attributes: new Map(),
						classes: [],
						styles: {},
					}),
				],
			});
			expect(parsingResult.data[3]).toMatchObject({
				startTime: 5000,
				endTime: 10000,
				content: "ji",
				id: "cue-9-79",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: undefined,
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				entities: [
					new Entities.Tag({
						tagType: Entities.TagType.RUBY,
						attributes: new Map(),
						classes: [],
						styles: {},
					}),
					new Entities.Tag({
						tagType: Entities.TagType.RT,
						attributes: new Map(),
						classes: [],
						styles: {},
					}),
				],
			});
		});

		it("should return a cue with a region associated", () => {
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

			const parsingResult = adapter.parse(REGION_WITH_ATTRIBUTES);

			expect(parsingResult.data[0]).toMatchObject({
				content:
					"Mamma mia, Marcello, that's not how you hold a gun.\nAlberto, come to look at Marcello!\n",
				startTime: 5000,
				endTime: 10000,
				entities: [],
				id: "cue-97-226",
				/**
				 * @type {import("@sub37/server").RenderingModifiers}
				 */
				renderingModifiers: {
					id: 97,
					regionIdentifier: "fred",
					textAlignment: "center",
					width: 100,
					leftOffset: 0,
				},
				region: {
					id: "fred",
					width: 40,
					lines: 3,
				},
			});
		});

		describe("styles", () => {
			describe("should correctly apply styles to tag entities and apply them to cues", () => {
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

					const parsingResult = adapter.parse(CUE_WITH_STYLE_WITHOUT_ID);

					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\nAlberto, come to look at Marcello!\n";

					expect(parsingResult.data[0]).toMatchObject({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								styles: {
									"background-color": "purple",
								},
								attributes: new Map(),
								tagType: Entities.TagType.SPAN,
								classes: [],
							}),
						],
						id: "cue-53-187",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});
				});

				it("should add only style that matches the id", () => {
					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\nAlberto, come to look at Marcello!\n";

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

					const parsingResult1 = adapter.parse(CUE_WITH_STYLE_WITH_CSS_ID);

					expect(parsingResult1.data[0]).toMatchObject({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								styles: {
									"background-color": "purple",
								},
								tagType: Entities.TagType.SPAN,
								attributes: new Map(),
								classes: [],
							}),
						],
						id: "test",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
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

					const parsingResult2 = adapter.parse(CUE_WITH_STYLE_WITH_ESCAPED_ID);

					expect(parsingResult2.data[0]).toMatchObject({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								tagType: Entities.TagType.SPAN,
								attributes: new Map(),
								styles: {
									"background-color": "red",
								},
								classes: [],
							}),
						],
						id: "123",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});
				});

				it("should add only style that matches the tag", () => {
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

					const parsingResult1 = adapter.parse(CUE_WITH_STYLE_WITH_CSS_TAG);

					expect(parsingResult1.data[0]).toMatchObject({
						content: "Mamma mia, Marcello",
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								tagType: 32,
								styles: {
									"background-color": "purple",
								},
								attributes: new Map(),
								classes: [],
							}),
						],
						id: "cue-103-244",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});

					expect(parsingResult1.data[1]).toMatchObject({
						content: ", that's not how you hold a gun.\nAlberto, come to look at Marcello!\n",
						startTime: 5000,
						endTime: 10000,
						entities: [],
						id: "cue-103-244",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});
				});

				it("should apply all styles and tags", () => {
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

					const parsingResult1 = adapter.parse(CUE_WITH_STYLE_WITH_CSS_TAG);

					expect(parsingResult1.data[0]).toMatchObject({
						content: "Mamma mia, Marcello",
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								tagType: Entities.TagType.SPAN,
								attributes: new Map(),
								styles: {
									"background-color": "red",
								},
								classes: [],
							}),
							new Entities.Tag({
								tagType: Entities.TagType.BOLD,
								attributes: new Map(),
								styles: {
									"background-color": "purple",
								},
								classes: [],
							}),
						],
						id: "test",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});

					expect(parsingResult1.data[1]).toMatchObject({
						content: ", that's not how you hold a gun.\nAlberto, come to look at Marcello!\n",
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								tagType: Entities.TagType.SPAN,
								attributes: new Map(),
								styles: {
									"background-color": "red",
								},
								classes: [],
							}),
						],
						id: "test",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});
				});

				it("should apply all styles for tags with the same attributes", () => {
					const content =
						"Mamma mia, Marcello, that's not how you hold a gun.\nAlberto, come to look at Marcello!\n";

					const CUE_WITH_STYLE_WITH_CSS_TAG_NO_ATTRIBUTES = `
WEBVTT

STYLE
::cue(v) {
	background-color: purple;
}

STYLE
::cue(v[voice="Fred"]) {
	background-color: red;
}

test
00:00:05.000 --> 00:00:10.000 region:fred
<v>Mamma mia, Marcello, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult1 = adapter.parse(CUE_WITH_STYLE_WITH_CSS_TAG_NO_ATTRIBUTES);

					expect(parsingResult1.data[0]).toMatchObject({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								tagType: 1,
								attributes: new Map(),
								styles: {
									"background-color": "purple",
								},
								classes: [],
							}),
						],
						id: "test",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});

					const CUE_WITH_STYLE_WITH_CSS_TAG_ATTRIBUTES = `
WEBVTT

STYLE
::cue(v[voice="Mimmo"]) {
	background-color: purple;
}

STYLE
::cue(v[voice="Fred"]) {
	background-color: red;
}

STYLE
::cue(v[voice]) {
	background-color: pink;
}

test
00:00:05.000 --> 00:00:10.000 region:fred
<v Fred>Mamma mia, Marcello, that's not how you hold a gun.
Alberto, come to look at Marcello!
					`;

					const parsingResult2 = adapter.parse(CUE_WITH_STYLE_WITH_CSS_TAG_ATTRIBUTES);

					expect(parsingResult2.data[0]).toMatchObject({
						content,
						startTime: 5000,
						endTime: 10000,
						entities: [
							new Entities.Tag({
								tagType: 1,
								attributes: new Map([["voice", "Fred"]]),
								styles: {
									"background-color": "pink",
								},
								classes: [],
							}),
						],
						id: "test",
						/**
						 * @type {import("@sub37/server").RenderingModifiers}
						 */
						renderingModifiers: {
							id: 97,
							regionIdentifier: "fred",
							textAlignment: "center",
							width: 100,
							leftOffset: 0,
						},
					});
				});
			});
		});
	});
});
