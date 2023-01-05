// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HSSession } from "../lib/Session.js";
import { IntervalBinaryTree } from "../lib/IntervalBinaryTree.js";
import { BaseAdapter, ParseResult } from "../lib/BaseAdapter";
import { CueNode } from "../lib/CueNode.js";
import {
	UnexpectedParsingOutputFormatError,
	UncaughtParsingExceptionError,
} from "../lib/Errors/index.js";

class MockedAdapter extends BaseAdapter {
	static toString() {
		return "Mocked Adapter";
	}

	toString() {
		return "Mocked Adapter";
	}

	/**
	 *
	 * @param {*} content
	 * @returns {ParseResult}
	 */
	parse(content) {
		return BaseAdapter.ParseResult([], []);
	}
}

class MockedAdapterWithParseResultError {
	static toString() {
		return "Mocked Adapter With Parse Result Error";
	}

	toString() {
		return "Mocked Adapter With Parse Result Error";
	}

	/**
	 *
	 * @param {string} content
	 * @returns {ParseResult}
	 */
	parse(content) {
		return BaseAdapter.ParseResult(
			[
				new CueNode({
					content,
					endTime: 0,
					startTime: 0,
					id: "mocked",
				}),
			],
			[
				{
					error: new Error("mocked adapter error"),
					failedChunk: "",
					isCritical: false,
				},
			],
		);
	}
}

const originalParseMethod = MockedAdapter.prototype.parse;

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
		MockedAdapter.prototype.parse = originalParseMethod;
	});

	it("Should throw if adapter doesn't return expected data structure", () => {
		// ********************* //
		// *** MOCKING START *** //
		// ********************* //

		/**
		 * @param {CueNode[]} content
		 * @returns
		 */

		// @ts-expect-error
		MockedAdapter.prototype.parse = function (content) {
			return content;
		};

		// ******************* //
		// *** MOCKING END *** //
		// ******************* //

		expect(() => {
			new HSSession(
				[
					{
						content: "This content format is not actually important. adapter is mocked",
						lang: "eng",
					},
				],
				new MockedAdapter(),
				() => {},
			);
		}).toThrow(UnexpectedParsingOutputFormatError);

		MockedAdapter.prototype.parse = originalParseMethod;
	});

	it("Should throw if adapter crashes", () => {
		// ********************* //
		// *** MOCKING START *** //
		// ********************* //

		/**
		 * @param {CueNode[]} content
		 * @returns
		 */

		MockedAdapter.prototype.parse = function (content) {
			throw new Error("Mocked Error");
		};

		// ******************* //
		// *** MOCKING END *** //
		// ******************* //

		expect(() => {
			new HSSession(
				[
					{
						content: "This content format is not actually important. adapter is mocked",
						lang: "eng",
					},
				],
				new MockedAdapter(),
				() => {},
			);
		}).toThrowError(UncaughtParsingExceptionError);

		MockedAdapter.prototype.parse = originalParseMethod;
	});

	it("should create a timeline for each passed track that has content and didn't throw", () => {
		// *************** //
		// *** MOCKING *** //
		// *************** //

		MockedAdapter.prototype.parse = function () {
			return BaseAdapter.ParseResult(
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

		const session = new HSSession(mockedTracks, new MockedAdapter(), () => {});

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
		const session = new HSSession(mockedEmptyTracks, new MockedAdapter(), () => {});

		/** @type {Array<[string, IntervalBinaryTree]>} */
		const timelines = Object.entries(
			// @ts-ignore
			session.timelines,
		);

		expect(timelines.length).toBe(0);
	});

	it("should warn if a non existing track is set", () => {
		const session = new HSSession(mockedEmptyTracks, new MockedAdapter(), () => {});

		const warn = jest.spyOn(console, "warn");
		expect(session.activeTrack).toBe(null);

		session.activeTrack = "ita";
		expect(warn).toBeCalledTimes(1);
		expect(session.activeTrack).toBe(null);

		warn.mockReset();
	});

	it("should call safeFailure callback when adapter goes bad", () => {
		/**
		 * @param {Error} error
		 */

		function onSafeFailureCb(error) {}

		/**
		 * Jest is not happy if we don't do this. Meh
		 */

		const mockObject = { onSafeFailureCb };

		const spy = jest.spyOn(mockObject, "onSafeFailureCb");
		const mockedError = new Error("mocked adapter error");

		new HSSession(
			mockedEmptyTracks,
			new MockedAdapterWithParseResultError(),
			mockObject.onSafeFailureCb,
		);

		expect(spy).toHaveBeenCalledTimes(2); /** One error per track */
		expect(spy).toHaveBeenCalledWith(mockedError);
	});
});
