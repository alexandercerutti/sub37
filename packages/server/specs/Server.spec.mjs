// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HSBaseRenderer } from "../lib/BaseRenderer";
import { HSServer } from "../lib/Server";

class MockedRendererNoExtend {
	static get supportedType() {
		return "text/vtt";
	}
}

class MockedRendererNoSupportedType extends HSBaseRenderer {}
class MockedRendererNoParse extends HSBaseRenderer {}

class MockedRenderer extends HSBaseRenderer {
	static get supportedType() {
		return "text/vtt";
	}

	/** @returns {import("../lib/TimelineTree").CueNode[]} */
	parse() {
		return [];
	}
}

const originalRendererParse = MockedRenderer.prototype.parse;

describe("HSServer", () => {
	it("should throw if no renderer is passed when a server is initialized", () => {
		debugger;
		expect(() => new HSServer()).toThrowError();
	});

	it("should throw if no valid renderer is left after filtering out invalid ones", () => {
		// @ts-expect-error
		expect(() => new HSServer(MockedRendererNoExtend)).toThrowError();
		expect(() => new HSServer(MockedRendererNoSupportedType)).toThrowError();
		expect(() => new HSServer(MockedRendererNoParse)).toThrowError();
	});

	describe("createSession", () => {
		it("should warn of missing supported renderers", () => {
			const warn = jest.spyOn(console, "warn");

			const server = new HSServer(MockedRenderer);
			server.createSession(
				[
					{
						content: "any",
						lang: "ita",
					},
				],
				"application/x-subrip",
			);

			expect(warn).toHaveBeenCalledTimes(1);
			warn.mockReset();
		});
	});

	describe("start", () => {
		function mockGetCurrentPositionFactory() {
			let second = 0;

			return function () {
				const nextValue = second;
				second += 0.3;

				return nextValue;
			};
		}

		it("should throw if no session has been created first", () => {
			const server = new HSServer(MockedRenderer);

			expect(() => server.start(mockGetCurrentPositionFactory())).toThrowError(
				"No session started. Engine won't serve any subtitles.",
			);
		});

		it("[timed] should start distributing cues", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			MockedRenderer.prototype.parse = function () {
				return [
					{
						content: "This is a sample cue",
						startTime: 0,
						endTime: 3,
					},
					{
						content: "This is a sample cue second",
						startTime: 1,
						endTime: 3,
					},
					{
						content: "This is a sample cue third",
						startTime: 3,
						endTime: 5,
					},
					{
						content: "This is a sample cue fourth",
						startTime: 5,
						endTime: 7,
					},
				];
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new HSServer(MockedRenderer);

			server.createSession(
				[
					{
						content: "any",
						lang: "ita",
					},
				],
				"text/vtt",
			);

			let currentCues = 0;
			const expectedCues = 4;

			server.addEventListener("cuestart", (nodes) => {
				/** We expect 4 ticks, one for each cue hardcoded */
				currentCues++;
			});

			server.addEventListener("cuestop", () => {
				console.log("cuestop reached");

				if (currentCues === expectedCues) {
					done();
					MockedRenderer.prototype.parse = originalRendererParse;
				}
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);

		it("[timed] should allow switching language", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			MockedRenderer.prototype.parse = function (content) {
				return content;
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new HSServer(MockedRenderer);

			server.createSession(
				[
					{
						content: [
							{
								content: "This is a sample cue",
								startTime: 0,
								endTime: 3,
							},
							{
								content: "This is a sample cue second",
								startTime: 1,
								endTime: 3,
							},
							{
								content: "This is a sample cue third",
								startTime: 3,
								endTime: 5,
							},
							{
								content: "This is a sample cue fourth",
								startTime: 5,
								endTime: 7,
							},
						],
						lang: "eng",
					},
					{
						content: [
							{
								content: "Questo è un cue di prova",
								startTime: 0,
								endTime: 3,
							},
							{
								content: "Questo è un cue di prova secondo",
								startTime: 1,
								endTime: 3,
							},
							{
								content: "Questo è un cue di prova terzo",
								startTime: 3,
								endTime: 5,
							},
							{
								content: "Questo è un cue di prova quarto",
								startTime: 5,
								endTime: 7,
							},
						],
						lang: "ita",
					},
				],
				"text/vtt",
			);

			/** 4 cues total + 1 which whill be the middle one ITA repeated on language switch */
			const expectedCues = 5;
			const cuesSequence = [];

			server.addEventListener("cuestart", (nodes) => {
				/** We expect 4 ticks, one for each cue hardcoded */
				cuesSequence.push([...nodes]);

				if (cuesSequence.length === 2) {
					server.selectTextTrack("ita");
				}
			});

			server.addEventListener("cuestop", () => {
				console.log("cuestop reached");

				if (cuesSequence.length === expectedCues) {
					expect(cuesSequence).toEqual([
						/** 0ms - 750ms */
						[{ content: "This is a sample cue", startTime: 0, endTime: 3 }],
						/** 750ms - 3000ms -> Next we do switch language */
						[
							{ content: "This is a sample cue", startTime: 0, endTime: 3 },
							{
								content: "This is a sample cue second",
								startTime: 1,
								endTime: 3,
							},
						],
						/** 750ms - 3000ms */
						[
							{
								content: "Questo è un cue di prova",
								startTime: 0,
								endTime: 3,
							},
							{
								content: "Questo è un cue di prova secondo",
								startTime: 1,
								endTime: 3,
							},
						],
						/** 3000ms - 5000ms */
						[
							{
								content: "Questo è un cue di prova terzo",
								startTime: 3,
								endTime: 5,
							},
						],
						/** 5000ms - 7000ms */
						[
							{
								content: "Questo è un cue di prova quarto",
								startTime: 5,
								endTime: 7,
							},
						],
					]);

					done();
					MockedRenderer.prototype.parse = originalRendererParse;
				}
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);
	});
});
