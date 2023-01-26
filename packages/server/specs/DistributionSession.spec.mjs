// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { DistributionSession } from "../lib/DistributionSession.js";
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

describe("DistributionSession", () => {
	/** @type {import("../lib/Track").TrackRecord[]} */
	const mockedTracks = [
		{
			lang: "ita",
			content: "WEBVTT",
			mimeType: "text/vtt",
		},
		{
			lang: "eng",
			content: "WEBVTT",
			mimeType: "text/vtt",
		},
	];

	/** @type {import("../lib/Track").TrackRecord[]} */
	const mockedEmptyTracks = [
		{
			lang: "ita",
			content: "",
			mimeType: "text/vtt",
		},
		{
			lang: "eng",
			content: "",
			mimeType: "text/vtt",
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
			new DistributionSession(
				[
					{
						content: "This content format is not actually important. adapter is mocked",
						lang: "eng",
						mimeType: "text/vtt",
						adapter: new MockedAdapter(),
					},
				],
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
			new DistributionSession(
				[
					{
						content: "This content format is not actually important. adapter is mocked",
						lang: "eng",
						mimeType: "text/vtt",
						adapter: new MockedAdapter(),
					},
				],
				() => {},
			);
		}).toThrowError(UncaughtParsingExceptionError);

		MockedAdapter.prototype.parse = originalParseMethod;
	});

	it("should create a track for each provided session track that has content and didn't throw", () => {
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

		/**
		 * @type {import("../lib/DistributionSession").SessionTrack[]}
		 */
		const trackRecords = mockedTracks.map((record) => ({
			...record,
			adapter: new MockedAdapter(),
		}));

		const session = new DistributionSession(trackRecords, () => {});

		expect(session.availableTracks.length).toBe(trackRecords.length);
	});

	it("should ignore tracks that have no output", () => {
		/**
		 * @type {import("../lib/DistributionSession").SessionTrack[]}
		 */
		const trackRecords = mockedEmptyTracks.map((record) => ({
			...record,
			adapter: new MockedAdapter(),
		}));

		const session = new DistributionSession(trackRecords, () => {});
		expect(session.availableTracks.length).toBe(0);
	});

	it("should honor session tracks active attribute", () => {
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

		/**
		 * @type {import("../lib/DistributionSession").SessionTrack[]}
		 */
		const trackRecords = mockedEmptyTracks.map((record) => ({
			...record,
			adapter: new MockedAdapter(),
		}));

		trackRecords[0].active = true;
		trackRecords[1].active = true;

		const session = new DistributionSession(trackRecords, () => {});

		expect(session.availableTracks.length).toBe(trackRecords.length);
		expect(session.activeTracks.length).toBe(2);
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

		/**
		 * @type {import("../lib/DistributionSession").SessionTrack[]}
		 */
		const trackRecords = mockedEmptyTracks.map((record) => ({
			...record,
			adapter: new MockedAdapterWithParseResultError(),
		}));

		new DistributionSession(trackRecords, mockObject.onSafeFailureCb);

		expect(spy).toHaveBeenCalledTimes(2); /** One error per track */
		expect(spy).toHaveBeenCalledWith(mockedError);
	});
});
