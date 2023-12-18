// @ts-check

import { describe, expect, it } from "@jest/globals";
import { matchClockTimeExpression } from "../lib/Parser/TimeExpressions/matchers/clockTime.js";
import { matchOffsetTimeExpression } from "../lib/Parser/TimeExpressions/matchers/offsetTime.js";
import { matchWallClockTimeExpression } from "../lib/Parser/TimeExpressions/matchers/wallclockTime.js";

describe("parseCue", () => {
	describe("regex time conversion", () => {
		// hours : minutes : seconds (. fraction | : frames ('.' sub-frames)? )?
		describe("Clock Time", () => {
			it("Should not convert 'hh' and 'hh:mm'", () => {
				expect(matchClockTimeExpression("10")).toBe(null);
				expect(matchClockTimeExpression("10:20")).toBe(null);
			});

			it("Should convert 'hh:mm:ss'", () => {
				expect(matchClockTimeExpression("22:57:10")).toEqual([22, 57, 10]);
			});

			it("Should convert 'hh:mm:ss.fraction'", () => {
				expect(matchClockTimeExpression("22:57:10.300")).toEqual([22, 57, 10.3]);
				expect(matchClockTimeExpression("22:57:10.033")).toEqual([22, 57, 10.033]);
			});

			it("Should convert 'hh:mm:ss:frames'", () => {
				expect(matchClockTimeExpression("22:57:10:8762231")).toEqual([22, 57, 10, 8762231]);
			});

			it("Should convert 'hh:mm:ss:frames.sub-frames'", () => {
				expect(matchClockTimeExpression("22:57:10:8762231.20")).toEqual([22, 57, 10, 8762231, 20]);
			});
		});

		describe("Offset time", () => {
			it("Should convert 'time-count fraction? metric'", () => {
				expect(matchOffsetTimeExpression("10f")).toEqual([10, 0, "f"]);
				expect(matchOffsetTimeExpression("10h")).toEqual([10, 0, "h"]);
				expect(matchOffsetTimeExpression("10.500f")).toEqual([10, 0.5, "f"]);
				expect(matchOffsetTimeExpression("10.050f")).toEqual([10, 0.05, "f"]);
			});
		});

		/** "wallclock(" <lwsp>? ( date-time | wall-time | date ) <lwsp>? ")" */
		describe("Wallclock time", () => {
			it("should convert 'wallclock(\"<lwsp>&quest; (date-time) <lwsp>&quest;\")'", () => {
				expect(matchWallClockTimeExpression(`wallclock(" 2020-05-10T22:10:57 ")`)).toEqual(
					new Date("2020-05-10T19:10:57.000Z"),
				);
				expect(matchWallClockTimeExpression(`wallclock(" 2021-06-10T22:10")`)).toEqual(
					new Date("2021-06-10T19:10:00.000Z"),
				);
			});

			it("should convert 'wallclock(\"<lwsp>&quest; (wall-time) <lwsp>&quest;\")'", () => {
				expect(matchWallClockTimeExpression(`wallclock("22:10:57 ")`)).toEqual(
					new Date("1970-01-01T21:10:57.000Z"),
				);
				expect(matchWallClockTimeExpression(`wallclock("22:10 ")`)).toEqual(
					new Date("1970-01-01T21:10:00.000Z"),
				);
			});

			it("should convert 'wallclock(\"<lwsp>&quest; (date) <lwsp>&quest;\")'", () => {
				expect(matchWallClockTimeExpression(`wallclock(" 2021-10-19 ")`)).toEqual(
					new Date(2021, 9, 19),
				);
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
