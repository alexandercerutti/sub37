// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { HSSession } from "../lib/Session.js";
import { TimelineTree } from "../lib/TimelineTree.js";
import { HSBaseRenderer } from "../lib/BaseRenderer";

class MockedRenderer extends HSBaseRenderer {
	/**
	 *
	 * @param {string} content
	 * @returns {Array<import("../lib/TimelineTree.js").CueNode>}
	 */
	parse(content) {
		return [];
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

	it("should create a timeline for each passed track that has content and didn't throw", () => {
		// *************** //
		// *** MOCKING *** //
		// *************** //

		MockedRenderer.prototype.parse = function () {
			return [
				{
					startTime: 0,
					endTime: 2000,
					content: "Whatever is your content, it will be displayed here",
				},
			];
		};

		// ******************* //
		// *** MOCKING END *** //
		// ******************* //

		const session = new HSSession(mockedTracks, new MockedRenderer());

		/** @type {Array<[string, TimelineTree]>} */
		const timelines = Object.entries(
			// @ts-ignore
			session.timelines,
		);

		const keys = timelines.map(([key]) => key);
		const values = timelines.map(([, value]) => value);

		expect(keys).toEqual(["ita", "eng"]);
		expect(values[0]).toBeInstanceOf(TimelineTree);
		expect(values[1]).toBeInstanceOf(TimelineTree);
	});

	it("should ignore tracks that have no output", () => {
		const session = new HSSession(mockedEmptyTracks, new MockedRenderer());

		/** @type {Array<[string, TimelineTree]>} */
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
