// @ts-check
import { describe, it, expect, afterEach, jest } from "@jest/globals";
import { DistributionSession } from "../lib/DistributionSession.js";
import { IntervalBinaryTree } from "../lib/IntervalBinaryTree.js";
import { BaseAdapter } from "@sub37/adapter-utils/BaseAdapter";
import { CueNode } from "@sub37/adapter-utils/CueNode";
import { UncaughtParsingExceptionError } from "../lib/Errors/index.js";

class MockedAdapter extends BaseAdapter {
	static toString() {
		return "Mocked Adapter";
	}

	toString() {
		return "Mocked Adapter";
	}

	*parse(content) {}
}

class MockedAdapterWithParseResultError {
	static toString() {
		return "Mocked Adapter With Parse Result Error";
	}

	toString() {
		return "Mocked Adapter With Parse Result Error";
	}

	*parse(content) {
		yield [
			new CueNode({
				content,
				endTime: 0,
				startTime: 0,
				id: "mocked",
			}),
			{
				error: new Error("mocked adapter error"),
				failedChunk: "",
				isCritical: false,
			},
		];
	}
}

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

	afterEach(() => jest.restoreAllMocks());

	it("Should throw if adapter doesn't return expected data structure", () => {
		// ********************* //
		// *** MOCKING START *** //
		// ********************* //

		// @ts-expect-error
		jest.spyOn(MockedAdapter.prototype, "parse").mockImplementation(function (content) {
			return content;
		});

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
		}).toThrow(UncaughtParsingExceptionError);
	});

	it("Should throw if adapter crashes", () => {
		// ********************* //
		// *** MOCKING START *** //
		// ********************* //

		jest.spyOn(MockedAdapter.prototype, "parse").mockImplementation(function* (content) {
			throw new Error("Mocked Error");
		});

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
	});

	it("should create a track for each provided session track that has content and didn't throw", () => {
		// *************** //
		// *** MOCKING *** //
		// *************** //

		jest.spyOn(MockedAdapter.prototype, "parse").mockImplementation(function* () {
			yield [
				new CueNode({
					id: "any",
					startTime: 0,
					endTime: 2000,
					content: "Whatever is your content, it will be displayed here",
				}),
			];
		});

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

		jest.spyOn(MockedAdapter.prototype, "parse").mockImplementation(function* () {
			yield [
				new CueNode({
					id: "any",
					startTime: 0,
					endTime: 2000,
					content: "Whatever is your content, it will be displayed here",
				}),
			];
		});

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
		expect(spy).toHaveBeenCalledWith(expect.objectContaining({ error: mockedError }));
	});
});
