// @ts-check

import { describe, expect, it } from "@jest/globals";
import { LogicalGroupingContext } from "../lib/Parser/LogicalGroupingContext.js";

describe("parseCue", () => {
	describe("regex time conversion", () => {
		// hours : minutes : seconds (. fraction | : frames ('.' sub-frames)? )?
		describe("Clock Time", () => {
			it.failing("Should not convert reject 'hh' and 'hh:mm'", () => {});

			it.failing("Should convert 'hh:mm:ss'", () => {
				// "22:57:10"
			});

			it.failing("Should convert 'hh:mm:ss.fraction'", () => {
				// 22:57:10.300
			});

			it.failing("Should convert 'hh:mm:ss:frames'", () => {
				// 22:57:10:8762231
			});

			it.failing("Should convert 'hh:mm:ss:frames.sub-frames'", () => {
				// 22:57:10:8762231.20
			});
		});

		describe("Offset time", () => {
			it.failing("Should convert 'time-count fraction? metric'", () => {
				// 10f, 10h
				// 10.500f
			});
		});

		/** "wallclock(" <lwsp>? ( date-time | wall-time | date ) <lwsp>? ")" */
		describe("Wallclock time", () => {
			it.failing("should convert 'wallclock(\"<lwsp>? (date-time) <lwsp>?\")'", () => {
				// wallclock(" YYYY-MM-DDTHH:MM:SS ")
				// wallclock(" YYYY-MM-DDTHH:MM ")
			});
			it.failing("should convert 'wallclock(\"<lwsp>? (wall-time) <lwsp>?\")'", () => {
				// wallclock(" HH:MM:SS ")
				// wallclock(" HH:MM ")
			});
			it.failing("should convert 'wallclock(\"<lwsp>? (date) <lwsp>?\")'", () => {
				// wallclock(" YYYY-MM-DD ")
			});
		});
	});

	describe("ttp:timeBase == 'clock'", () => {
		it.failing("should include only hours, minutes, seconds and fraction", () => {});
	});

	describe("ttp:timeBase == 'media'", () => {
		it.failing("should output a time that includes the previous one, if provided", () => {});

		it.failing(
			"should include frames, if provided with them, ttp:frameRate and ttp:frameRateMultiplier",
			() => {},
		);

		it.failing("should include subframes, if provided with them and ttp:subFrameRate", () => {});
	});

	describe("ttp:timeBase == 'smpte'", () => {
		it.failing(
			"should return a value based on frames, subframes, hours, minutes and seconds",
			() => {},
		);
	});
});

describe("LogicalGroupingContext", () => {
	/**
	 * @type { LogicalGroupingContext }
	 */

	let group;

	beforeEach(() => {
		group = new LogicalGroupingContext();
	});

	describe("styles", () => {
		it("should allow adding some styles", () => {
			addStylesToGroup(group);

			const stylesIterator = group.styles;

			expect(stylesIterator.next()).toEqual({
				value: {
					id: "t1",
					attributes: {},
				},
				done: false,
			});
			expect(stylesIterator.next()).toEqual({
				value: {
					id: "t2",
					attributes: {},
				},
				done: false,
			});
			/**
			 * We need to do so, otherwise a for-of loop won't
			 * return the last item
			 */
			expect(stylesIterator.next()).toEqual({
				value: undefined,
				done: true,
			});
		});

		it("should be able to iterate all the parent styles", () => {
			addStylesToGroup(group);

			for (let i = 0; i < 6; i++) {
				group = new LogicalGroupingContext(group);
				addStylesToGroup(group);
			}

			const stylesIterator = group.styles;
			expect(stylesIterator.length).toBe(14);

			/**
			 * @type { import("../lib/Parser/parseStyle.js").TTMLStyle[] }
			 */

			let exploredStyles = [];

			for (const style of stylesIterator) {
				exploredStyles.push(style);
			}

			expect(exploredStyles.length).toBe(14);
		});
	});
});

/**
 *
 * @param {LogicalGroupingContext} group
 * @returns
 */

function addStylesToGroup(group) {
	group.addStyles(
		{
			id: "t1",
			attributes: {},
		},
		{
			id: "t2",
			attributes: {},
		},
	);
}
