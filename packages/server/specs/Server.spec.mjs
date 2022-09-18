// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HSBaseRenderer, ParseResult } from "../lib/BaseRenderer";
import { HSServer } from "../lib/Server";
import { CueNode } from "../lib/CueNode";

class MockedRendererNoExtend {
	static rendererName = "NoExtendRenderer";
	static get supportedType() {
		return "text/vtt";
	}
}

class MockedRendererNoSupportedType extends HSBaseRenderer {}
class MockedRendererNoParse extends HSBaseRenderer {}

class MockedRenderer extends HSBaseRenderer {
	static rendererName = "MockedRenderer";

	static get supportedType() {
		return "text/vtt";
	}

	/**
	 * @param {CueNode[]} content
	 * @returns {ParseResult}
	 */
	parse(content) {
		return HSBaseRenderer.ParseResult([], []);
	}
}

const originalRendererParse = MockedRenderer.prototype.parse;

function mockGetCurrentPositionFactory() {
	let second = 0;

	return function () {
		const nextValue = second;
		second += 0.3;

		return nextValue;
	};
}

// ********************** //
// *** SPECIFICATIONS *** //
// ********************** //

describe("HSServer", () => {
	it("should throw if no renderer is passed when a server is initialized", () => {
		expect(() => new HSServer()).toThrowError();
	});

	it("should throw if no valid renderer is left after filtering out invalid ones", () => {
		// @ts-expect-error
		expect(() => new HSServer(MockedRendererNoExtend)).toThrowError();
		expect(() => new HSServer(MockedRendererNoSupportedType)).toThrowError();
		expect(() => new HSServer(MockedRendererNoParse)).toThrowError();
	});

	describe("createSession", () => {
		it("should throw on missing supported renderers", () => {
			expect(() => {
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
			}).toThrow();
		});
	});

	describe("updateTime", () => {
		/**
		 * @type {HSServer}
		 */

		let server;

		beforeAll(() => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			MockedRenderer.prototype.parse = function () {
				// Low times to reduce test duration
				// Mocked position factory steps by 1,
				// but video tags step 4 times per second

				return HSBaseRenderer.ParseResult(
					[
						new CueNode({
							content: "This is a sample cue",
							startTime: 0,
							endTime: 1,
							id: "any",
						}),
						new CueNode({
							content: "This is a sample cue second",
							startTime: 0.4,
							endTime: 1,
							id: "any",
						}),
						new CueNode({
							content: "This is a sample cue third",
							startTime: 1,
							endTime: 2.5,
							id: "any",
						}),
						new CueNode({
							content: "This is a sample cue fourth",
							startTime: 2.5,
							endTime: 4,
							id: "any",
						}),
					],
					[],
				);
			};
		});

		beforeEach(() => {
			server = new HSServer(MockedRenderer);

			server.createSession(
				[
					{
						content: "any",
						lang: "ita",
					},
				],
				"text/vtt",
			);
		});

		afterAll(() => {
			MockedRenderer.prototype.parse = originalRendererParse;
		});

		it("should allow updating the manually the time if the server is paused", () => {
			server.start(mockGetCurrentPositionFactory());
			server.suspend();

			server.addEventListener("cuestart", (nodes) => {
				expect(nodes.length).toBe(1);
				expect(nodes[0].content).toBe("This is a sample cue third");
			});

			server.updateTime(1.2);
		}, 3000);

		it("should throw if server is not started", () => {
			expect(() => server.updateTime(1200)).toThrow();
		});

		it("should throw if server is running", () => {
			server.start(mockGetCurrentPositionFactory());
			expect(() => server.updateTime(1200)).toThrow();
		});
	});

	describe("start", () => {
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
				// Low times to reduce test duration
				// Mocked position factory steps by 1,
				// but video tags step 4 times per second

				return HSBaseRenderer.ParseResult(
					[
						new CueNode({
							content: "This is a sample cue",
							startTime: 0,
							endTime: 1,
							id: "any",
						}),
						new CueNode({
							content: "This is a sample cue second",
							startTime: 0.4,
							endTime: 1,
							id: "any",
						}),
						new CueNode({
							content: "This is a sample cue third",
							startTime: 1,
							endTime: 2.5,
							id: "any",
						}),
						new CueNode({
							content: "This is a sample cue fourth",
							startTime: 2.5,
							endTime: 4,
							id: "any",
						}),
					],
					[],
				);
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

			/**
			 * @param {CueNode[]} content
			 * @returns
			 */

			MockedRenderer.prototype.parse = function (content) {
				return HSBaseRenderer.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new HSServer(MockedRenderer);

			server.createSession(
				[
					{
						content: [
							new CueNode({
								content: "This is a sample cue",
								startTime: 0,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue second",
								startTime: 0.4,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue third",
								startTime: 1,
								endTime: 2.5,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue fourth",
								startTime: 2.5,
								endTime: 4,
								id: "any",
							}),
						],
						lang: "eng",
					},
					{
						content: [
							new CueNode({
								content: "Questo è un cue di prova",
								startTime: 0,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "Questo è un cue di prova secondo",
								startTime: 0.4,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "Questo è un cue di prova terzo",
								startTime: 1,
								endTime: 2.5,
								id: "any",
							}),
							new CueNode({
								content: "Questo è un cue di prova quarto",
								startTime: 2.5,
								endTime: 4,
								id: "any",
							}),
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
						/** Persisting time: 0ms - 400ms */
						[
							new CueNode({
								content: "This is a sample cue",
								startTime: 0,
								endTime: 1,
								entities: [],
								id: "any",
							}),
						],
						/** Persisting time: 400ms - 1000ms */
						[
							new CueNode({
								content: "This is a sample cue",
								startTime: 0,
								endTime: 1,
								entities: [],
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue second",
								startTime: 0.4,
								endTime: 1,
								entities: [],
								id: "any",
							}),
						],
						/** Here we change language to Italian */
						/** Persisting time: 400ms - 1000ms */
						[
							new CueNode({
								content: "Questo è un cue di prova",
								startTime: 0,
								endTime: 1,
								entities: [],
								id: "any",
							}),
							new CueNode({
								content: "Questo è un cue di prova secondo",
								startTime: 0.4,
								endTime: 1,
								entities: [],
								id: "any",
							}),
						],
						/** Persisting time: 1000ms - 2500ms */
						[
							new CueNode({
								content: "Questo è un cue di prova terzo",
								startTime: 1,
								endTime: 2.5,
								entities: [],
								id: "any",
							}),
						],
						/** Persisting time: 2500ms - 4000ms */
						[
							new CueNode({
								content: "Questo è un cue di prova quarto",
								startTime: 2.5,
								endTime: 4,
								entities: [],
								id: "any",
							}),
						],
					]);

					done();
					MockedRenderer.prototype.parse = originalRendererParse;
				}
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);

		it("[timed] can be suspended and resumed", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			/**
			 * @param {CueNode[]} content
			 * @returns
			 */

			MockedRenderer.prototype.parse = function (content) {
				return HSBaseRenderer.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new HSServer(MockedRenderer);

			server.createSession(
				[
					{
						content: [
							new CueNode({
								content: "This is a sample cue",
								startTime: 0,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue second",
								startTime: 0.4,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue third",
								startTime: 1,
								endTime: 2.5,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue fourth",
								startTime: 2.5,
								endTime: 4,
								id: "any",
							}),
						],
						lang: "eng",
					},
				],
				"text/vtt",
			);

			let currentCues = 0;

			server.addEventListener("cuestart", (nodes) => {
				currentCues++;

				if (currentCues === 2) {
					server.suspend();
					expect(server.isRunning).toBe(false);

					setTimeout(() => {
						server.resume();
						expect(server.isRunning).toBe(true);

						const checkInterval = window.setInterval(() => {
							if (currentCues > 2) {
								window.clearInterval(checkInterval);
								MockedRenderer.prototype.parse = originalRendererParse;
								done();
							}
						}, 500);
					}, 500);
				}
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);

		it("[timed] should emit a stop if track is changed to null while running", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			/**
			 * @param {CueNode[]} content
			 * @returns
			 */

			MockedRenderer.prototype.parse = function (content) {
				return HSBaseRenderer.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new HSServer(MockedRenderer);

			server.createSession(
				[
					{
						content: [
							new CueNode({
								content: "This is a sample cue",
								startTime: 0,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue second",
								startTime: 0.4,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue third",
								startTime: 1,
								endTime: 2.5,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue fourth",
								startTime: 2.5,
								endTime: 4,
								id: "any",
							}),
						],
						lang: "eng",
					},
				],
				"text/vtt",
			);

			let currentCues = 0;

			server.addEventListener("cuestart", (nodes) => {
				currentCues++;

				if (currentCues === 2) {
					server.selectTextTrack(null);
				}
			});

			server.addEventListener("cuestop", () => {
				expect(currentCues).toBe(2);
				expect(server.isRunning).toBe(false);
				done();
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);

		it("[timed] should throw through assertions if commands are executed in the wrong places", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			/**
			 * @param {CueNode[]} content
			 * @returns
			 */

			MockedRenderer.prototype.parse = function (content) {
				return HSBaseRenderer.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new HSServer(MockedRenderer);

			expect(() => server.suspend()).toThrow();
			expect(() => server.resume()).toThrow();

			server.createSession(
				[
					{
						content: [
							new CueNode({
								content: "This is a sample cue",
								startTime: 0,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue second",
								startTime: 0.4,
								endTime: 1,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue third",
								startTime: 1,
								endTime: 2.5,
								id: "any",
							}),
							new CueNode({
								content: "This is a sample cue fourth",
								startTime: 2.5,
								endTime: 4,
								id: "any",
							}),
						],
						lang: "eng",
					},
				],
				"text/vtt",
			);

			let currentCues = 0;

			server.addEventListener("cuestart", (nodes) => {
				currentCues++;

				if (currentCues === 2) {
					server.selectTextTrack(null);
					expect(() => server.suspend()).toThrow();
				}
			});

			server.addEventListener("cuestop", () => {
				server.resume();
				expect(() => server.resume()).toThrow();
				server.suspend();
				done();
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);
	});
});
