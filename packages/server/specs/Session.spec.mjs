// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HSSession } from "../lib/Session.js";
import { IntervalBinaryTree } from "../lib/IntervalBinaryTree.js";
import { HSBaseRenderer, ParseResult } from "../lib/BaseRenderer";
import { CueNode } from "../lib/CueNode.js";
import {
	UnexpectedParsingOutputFormatError,
	UncaughtParsingExceptionError,
} from "../lib/Errors/index.js";

class MockedRenderer extends HSBaseRenderer {
	static rendererName = "Mocked Renderer";

	/**
	 *
	 * @param {string} content
	 * @returns {ParseResult}
	 */
	parse(content) {
		return HSBaseRenderer.ParseResult([], []);
	}
}

const originalParseMethod = MockedRenderer.prototype.parse;

describe("HSSession", () => {
	/** @type {import("../lib/model").RawTrack[]} */
	const mockedTracks = [
		{
			lang: "ita",
			content: "WEBVTT",
		},
		{
			lang: "eng",
			content: "WEBVTT",
		},
	];

	/** @type {import("../lib/model").RawTrack[]} */
	const mockedEmptyTracks = [
		{
			lang: "ita",
			content: "",
		},
		{
			lang: "eng",
			content: "",
		},
	];

	beforeEach(() => {
		MockedRenderer.prototype.parse = originalParseMethod;
	});

	it("Should throw if Renderer doesn't return expected data structure", () => {
		// ********************* //
		// *** MOCKING START *** //
		// ********************* //

		/**
		 * @param {CueNode[]} content
		 * @returns
		 */

		// @ts-expect-error
		MockedRenderer.prototype.parse = function (content) {
			return content;
		};

		// ******************* //
		// *** MOCKING END *** //
		// ******************* //

		expect(() => {
			new HSSession(
				[
					{
						content: "This content format is not actually important. Renderer is mocked",
						lang: "eng",
					},
				],
				new MockedRenderer(),
			);
		}).toThrow(UnexpectedParsingOutputFormatError);

		MockedRenderer.prototype.parse = originalParseMethod;
	});

	it("Should throw if Renderer crashes", () => {
		// ********************* //
		// *** MOCKING START *** //
		// ********************* //

		/**
		 * @param {CueNode[]} content
		 * @returns
		 */

		// @ts-expect-error
		MockedRenderer.prototype.parse = function (content) {
			throw new Error("Mocked Error");
		};

		// ******************* //
		// *** MOCKING END *** //
		// ******************* //

		expect(() => {
			new HSSession(
				[
					{
						content: "This content format is not actually important. Renderer is mocked",
						lang: "eng",
					},
				],
				new MockedRenderer(),
			);
		}).toThrowError(UncaughtParsingExceptionError);

		MockedRenderer.prototype.parse = originalParseMethod;
	});

	it("should create a timeline for each passed track that has content and didn't throw", () => {
		// *************** //
		// *** MOCKING *** //
		// *************** //

		MockedRenderer.prototype.parse = function () {
			return HSBaseRenderer.ParseResult(
				[
					new CueNode({
						id: "any",
						startTime: 0,
						endTime: 2000,
						content: "Whatever is your content, it will be displayed here",
					}),
				],
				[],
			);
		};

		// ******************* //
		// *** MOCKING END *** //
		// ******************* //

		const session = new HSSession(mockedTracks, new MockedRenderer());

		/** @type {Array<[string, IntervalBinaryTree]>} */
		const timelines = Object.entries(
			// @ts-ignore
			session.timelines,
		);

		const keys = timelines.map(([key]) => key);
		const values = timelines.map(([, value]) => value);

		expect(keys).toEqual(["ita", "eng"]);
		expect(values[0]).toBeInstanceOf(IntervalBinaryTree);
		expect(values[1]).toBeInstanceOf(IntervalBinaryTree);
	});

	it("should ignore tracks that have no output", () => {
		const session = new HSSession(mockedEmptyTracks, new MockedRenderer());

		/** @type {Array<[string, IntervalBinaryTree]>} */
		const timelines = Object.entries(
			// @ts-ignore
			session.timelines,
		);

		expect(timelines.length).toBe(0);
	});

	it("should warn if a non existing track is set", () => {
		const session = new HSSession(mockedEmptyTracks, new MockedRenderer());

		const warn = jest.spyOn(console, "warn");
		expect(session.activeTrack).toBe(null);

		session.activeTrack = "ita";
		expect(warn).toBeCalledTimes(1);
		expect(session.activeTrack).toBe(null);

		warn.mockReset();
	});
});
