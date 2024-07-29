import { describe, expect, it } from "@jest/globals";
import {
	getMillisecondsByClockTime,
	getMillisecondsByOffsetTime,
	getMillisecondsByWallClockTime,
} from "../../lib/Parser/TimeBase/Clock.js";

describe("When timeBase is 'clock'", () => {
	it("should include only hours, minutes, seconds and fractions when converting to clock-time", () => {
		expect(getMillisecondsByClockTime([1, 15, 30.5, 25, 20])).toBe(4530500);
	});

	it("should return the date in milliseconds when converting to wallclock-time", () => {
		const currentTime = Date.now();
		expect(getMillisecondsByWallClockTime(new Date())).toBe(currentTime);
	});

	it("should return the milliseconds offset when converting to offset-time and metric is not a ticks", () => {
		expect(getMillisecondsByOffsetTime([10, 5, "s"], {})).toBe(10500);
		expect(getMillisecondsByOffsetTime([10, undefined, "s"], {})).toBe(10000);
	});

	it("should return the milliseconds offset when converting to offset-time and metric is ticks", () => {
		expect(
			getMillisecondsByOffsetTime([10_010_000, 100, "t"], { "ttp:tickRate": 10_000_000 }),
		).toBe(1001);
		expect(
			getMillisecondsByOffsetTime([10_010_000, undefined, "t"], { "ttp:tickRate": 10_000_000 }),
		).toBe(1001);
	});
});
