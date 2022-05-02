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

		const TIMESTAMPS_CUES_CONTENT = `
WEBVTT

00:00:16.000 --> 00:00:24.000
<00:00:16.000> <c.mimmo>This</c>
<00:00:18.000> <c>can</c>
<00:00:20.000> <c>match</c>
<00:00:22.000> <c>:past/:future</c>
<00:00:24.000>
`;

		const RUBY_RT_AUTOCLOSE = `
WEBVTT

00:00:05.000 --> 00:00:10.000
<ruby>漢 <rt>kan</rt> 字 <rt>ji</ruby>
`;

		it("should return an empty array if rawContent is falsy", () => {
			expect(renderer.parse(undefined)).toEqual([]);
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
				id: undefined,
				attributes: {
					align: "left",
				},
				entities: [
					{
						offset: 0,
						length: 31,
						type: 1, // voice
						attributes: ["Fred>"],
						/** @TODO add classes */
					},
				],
			});

			expect(parsingResult[1]).toEqual({
				startTime: 0,
				endTime: 20000,
				content: "Hi, my name is Fred",
				id: undefined,
				attributes: {
					align: "left",
				},
				entities: [
					{
						offset: 0,
						length: 19,
						type: 2, // lang
						attributes: ["en-US"],
						/** @TODO add classes */
					},
				],
			});
		});

		it("should return an array containing four cues when a timestamps are found", () => {
			const parsingResult = renderer.parse(TIMESTAMPS_CUES_CONTENT);
			expect(parsingResult).toBeInstanceOf(Array);
			expect(parsingResult.length).toEqual(4);

			expect(parsingResult[0]).toEqual({
				startTime: 16000,
				endTime: 24000,
				content: " This\n",
				id: undefined,
				attributes: {},
				entities: [
					{
						type: 16,
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
				id: undefined,
				attributes: {},
				entities: [
					{
						type: 16,
						offset: 1,
						length: 3,
						attributes: [],
					},
				],
			});
		});

		it("should return a cue with three entities when ruby autocloses a ruby-text <rt>", () => {
			const parsingResult = renderer.parse(RUBY_RT_AUTOCLOSE);
			expect(parsingResult).toBeInstanceOf(Array);
			expect(parsingResult.length).toEqual(1);

			expect(parsingResult[0]).toEqual({
				startTime: 5000,
				endTime: 10000,
				content: "漢 kan 字 ji\n",
				id: undefined,
				attributes: {},
				entities: [
					{
						type: 8,
						offset: 2,
						length: 3,
						attributes: [],
					},
					{
						type: 8,
						offset: 8,
						length: 2,
						attributes: [],
					},
					{
						type: 4,
						offset: 0,
						length: 10,
						attributes: [],
					},
				],
			});
		});
	});
});
