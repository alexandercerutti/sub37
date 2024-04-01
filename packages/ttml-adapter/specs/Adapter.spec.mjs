import { describe, it, expect } from "@jest/globals";
import TTMLAdapter from "../lib/Adapter.js";

/**
 * - A document without tt, is not considered a valid document
 *
 * - An XML that does not contain a <tt> element, should throw an error
 *
 * - A style tag gets correctly inherited by another style tag
 * - A style tag gets correctly inherited by a style tag inside a region
 * - A style tag places inside a region should not get inherited
 * - A style tag with an already available id should get a new one (todo: test tree equals --1, --2, --3)
 *
 * - A region tag should be parsed correctly only in layout/head and if it both a self-closing tag or not.
 * - A style tag should be parsed correctly only in stylings and if it both a self-closing tag or not.
 *
 * - A span should appear only inside a span or a p
 * - A p should appear only inside body or div
 *
 * - Timings:
 * 		- On an element specifying both "dur" and "end", should win the
 * 				Math.min(dur, end - begin). Test both cases.
 * 		- `referenceBegin` on `media` with par and seq
 */

// https://developer.mozilla.org/en-US/docs/Related/IMSC/Subtitle_placement

describe("Adapter", () => {
	it("should throw if if the track does not start with a <tt> element", () => {
		const adapter = new TTMLAdapter();
		expect(() => {
			adapter.parse(`
				<head>
					<layout></layout>
				</head>
				<body>
					<div>
						<p>Some Content that won't be used</p>
					</div>
				</body>
			`);
		}).toThrowError();
	});

	describe("Cues", () => {
		it("should emit anonymous cues with duration 0 when parent doesn't specify a duration", () => {});
	});
});

/**
 * @TODO add tests for
 *
 *  - div with multiple regions (only the first should be used)
 *  - p with multiple regions (only the first should be used)
 *  - Nested div and p with a region each, both should be applied to the outcoming cue
 */
