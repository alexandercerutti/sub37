// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BaseAdapter, ParseResult } from "../lib/BaseAdapter";
import { Server, Events } from "../lib/Server";
import {
	AdapterNotOverridingToStringError,
	AdapterNotExtendingPrototypeError,
	AdapterNotOverridingSupportedTypesError,
} from "../lib/Errors/index.js";
import { CueNode } from "../lib/CueNode";

class MockedAdapterNoExtend {
	static get supportedType() {
		return "text/vtt";
	}

	static toString() {
		return "NoExtendAdapter";
	}

	toString() {
		return "NoExtendAdapter";
	}
}

class MockedAdapterNoSupportedType extends BaseAdapter {
	static toString() {
		return "MockedAdapterNoSupportedType";
	}

	toString() {
		return "MockedAdapterNoSupportedType";
	}
}
class MockedAdapterNoParse extends BaseAdapter {}

class MockedAdapterNoStaticToString extends BaseAdapter {
	static get supportedType() {
		return "text/vtt";
	}
}

class MockedAdapter extends BaseAdapter {
	static toString() {
		return "MockedAdapter";
	}

	static get supportedType() {
		return "text/vtt";
	}

	toString() {
		return "MockedAdapter";
	}

	/**
	 * @param {CueNode[]} content
	 * @returns {ParseResult}
	 */
	parse(content) {
		return BaseAdapter.ParseResult([], []);
	}
}

const originalAdapterParse = MockedAdapter.prototype.parse;

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

describe("Server", () => {
	it("should throw if no adapter is passed when a server is initialized", () => {
		expect(() => new Server()).toThrowError();
	});

	it("should log errors out if a server is initialized with not compliant adapters", () => {
		const error = jest.spyOn(console, "error");

		/**
		 * @type {Array<import("../lib").BaseAdapterConstructor>}
		 */

		const adapters = [
			MockedAdapterNoStaticToString,
			// @ts-expect-error
			MockedAdapterNoExtend,
			MockedAdapterNoSupportedType,
			// Last one is valid so it doesn't actually crash
			MockedAdapter,
		];

		new Server(...adapters);

		expect(error).toHaveBeenCalledTimes(3);

		expect(error).toHaveBeenCalledWith(new AdapterNotOverridingToStringError());
		expect(error).toHaveBeenCalledWith(new AdapterNotExtendingPrototypeError("NoExtendAdapter"));
		expect(error).toHaveBeenCalledWith(
			new AdapterNotOverridingSupportedTypesError("MockedAdapterNoSupportedType"),
		);
	});

	it("should throw if no valid adapter is left after filtering out invalid ones", () => {
		// @ts-expect-error
		expect(() => new Server(MockedAdapterNoExtend)).toThrowError();
		expect(() => new Server(MockedAdapterNoSupportedType)).toThrowError();
		expect(() => new Server(MockedAdapterNoParse)).toThrowError();
	});

	describe("createSession", () => {
		it("should throw on missing supported adapters", () => {
			expect(() => {
				const server = new Server(MockedAdapter);
				server.createSession([
					{
						content: "any",
						lang: "ita",
						mimeType: "application/x-subrip",
					},
				]);
			}).toThrow();
		});
	});

	describe("updateTime", () => {
		/**
		 * @type {Server}
		 */

		let server;

		beforeAll(() => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			MockedAdapter.prototype.parse = function () {
				// Low times to reduce test duration
				// Mocked position factory steps by 1,
				// but video tags step 4 times per second

				return BaseAdapter.ParseResult(
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
			server = new Server(MockedAdapter);

			server.createSession([
				{
					content: "any",
					lang: "ita",
					mimeType: "text/vtt",
				},
			]);
		});

		afterAll(() => {
			MockedAdapter.prototype.parse = originalAdapterParse;
		});

		it("should allow updating the manually the time if the server is paused", () => {
			server.start(mockGetCurrentPositionFactory());
			server.suspend();

			server.addEventListener(Events.CUE_START, (nodes) => {
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
			const server = new Server(MockedAdapter);

			expect(() => server.start(mockGetCurrentPositionFactory())).toThrowError(
				"No session started. Engine won't serve any subtitles.",
			);
		});

		it("[timed] should start distributing cues", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			MockedAdapter.prototype.parse = function () {
				// Low times to reduce test duration
				// Mocked position factory steps by 1,
				// but video tags step 4 times per second

				return BaseAdapter.ParseResult(
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

			const server = new Server(MockedAdapter);

			server.createSession([
				{
					content: "any",
					lang: "ita",
					mimeType: "text/vtt",
					active: true,
				},
			]);

			let currentCues = 0;
			const expectedCues = 4;

			server.addEventListener(Events.CUE_START, (nodes) => {
				/** We expect 4 ticks, one for each cue hardcoded */
				currentCues++;
			});

			server.addEventListener(Events.CUE_STOP, () => {
				console.log("cuestop reached");

				if (currentCues === expectedCues) {
					done();
					MockedAdapter.prototype.parse = originalAdapterParse;
				}
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);

		it("[timed] should allow switching between languages", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			/**
			 * @param {CueNode[]} content
			 * @returns
			 */

			MockedAdapter.prototype.parse = function (content) {
				return BaseAdapter.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new Server(MockedAdapter);

			server.createSession([
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
					mimeType: "text/vtt",
					active: true,
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
					mimeType: "text/vtt",
					active: false,
				},
			]);

			/** 4 cues total + 1 which whill be the middle one ITA repeated on language switch */
			const expectedCues = 5;
			const cuesSequence = [];

			server.addEventListener(Events.CUE_START, (nodes) => {
				/** We expect 4 ticks, one for each cue hardcoded */
				cuesSequence.push([...nodes]);

				if (cuesSequence.length === 2) {
					server.switchTextTrackByLang("ita");
				}
			});

			server.addEventListener(Events.CUE_STOP, () => {
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

					const activeTracks = server.tracks.filter((track) => track.active);

					expect(activeTracks.length).toBe(1);
					expect(activeTracks[0].lang).toBe("ita");

					done();
					MockedAdapter.prototype.parse = originalAdapterParse;
				}
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);

		it("[timed] should be able to get suspended and resumed", (done) => {
			// ********************* //
			// *** MOCKING START *** //
			// ********************* //

			/**
			 * @param {CueNode[]} content
			 * @returns
			 */

			MockedAdapter.prototype.parse = function (content) {
				return BaseAdapter.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new Server(MockedAdapter);

			server.createSession([
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
					mimeType: "text/vtt",
					active: true,
				},
			]);

			let currentCues = 0;

			server.addEventListener(Events.CUE_START, (nodes) => {
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
								MockedAdapter.prototype.parse = originalAdapterParse;
								done();
							}
						}, 0);
					}, 0);
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

			MockedAdapter.prototype.parse = function (content) {
				return BaseAdapter.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new Server(MockedAdapter);

			server.createSession([
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
					mimeType: "text/vtt",
					active: true,
				},
			]);

			let currentCues = 0;

			server.addEventListener(Events.CUE_START, (nodes) => {
				currentCues++;

				if (currentCues === 2) {
					server.switchTextTrackByLang(null);
				}
			});

			server.addEventListener(Events.CUE_STOP, () => {
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

			MockedAdapter.prototype.parse = function (content) {
				return BaseAdapter.ParseResult(content, []);
			};

			// ******************* //
			// *** MOCKING END *** //
			// ******************* //

			const server = new Server(MockedAdapter);

			expect(() => server.suspend()).toThrow();
			expect(() => server.resume()).toThrow();

			server.createSession([
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
					mimeType: "text/vtt",
				},
			]);

			let currentCues = 0;

			server.addEventListener(Events.CUE_START, (nodes) => {
				currentCues++;

				if (currentCues === 2) {
					server.switchTextTrackByLang(null);
					expect(() => server.suspend()).toThrow();
				}
			});

			server.addEventListener(Events.CUE_STOP, () => {
				server.resume();
				expect(() => server.resume()).toThrow();
				server.suspend();
				done();
			});

			server.start(mockGetCurrentPositionFactory());
		}, 10000);
	});
});
