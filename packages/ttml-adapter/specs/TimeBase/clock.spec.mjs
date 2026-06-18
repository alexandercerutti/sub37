import { describe, expect, it } from "@jest/globals";
import {
	getMillisecondsByClockTime,
	getMillisecondsByOffsetTime,
	getMillisecondsByWallClockTime,
} from "../../lib/Parser/TimeBase/Clock.js";

describe("When timeBase is 'clock'", () => {
	it("should throw when converting in milliseconds if frames or subframes are passed, when converting to clock-time", () => {
		expect(() =>
			getMillisecondsByClockTime([
				{
					value: 1,
					metric: "hours",
				},
				{
					value: 15,
					metric: "minutes",
				},
				{
					value: 30.5,
					metric: "seconds",
				},
				{
					value: 25,
					metric: "frames",
				},
				{
					value: 20,
					metric: "subframes",
				},
			]),
		).toThrow();
	});

	it("should not throw when converting in milliseconds if frames or subframes are undefined, when converting to clock-time", () => {
		expect(() =>
			getMillisecondsByClockTime([
				{
					value: 1,
					metric: "hours",
				},
				{
					value: 15,
					metric: "minutes",
				},
				{
					value: 30.5,
					metric: "seconds",
				},
				{
					value: undefined,
					metric: "frames",
				},
				{
					value: undefined,
					metric: "subframes",
				},
			]),
		).not.toThrow();

		expect(() =>
			getMillisecondsByClockTime([
				{
					value: 1,
					metric: "hours",
				},
				{
					value: 15,
					metric: "minutes",
				},
				{
					value: 30.5,
					metric: "seconds",
				},
				undefined,
				undefined,
			]),
		).not.toThrow();
	});

	it("should include only hours, minutes, seconds and fractions when converting to clock-time", () => {
		expect(
			getMillisecondsByClockTime([
				{
					value: 1,
					metric: "hours",
				},
				{
					value: 15,
					metric: "minutes",
				},
				{
					value: 30.5,
					metric: "seconds",
				},
				undefined,
				undefined,
			]),
		).toBe(4530500);
	});

	it("should return the date in milliseconds when converting to wallclock-time", () => {
		const currentTime = Date.now();
		expect(getMillisecondsByWallClockTime({ value: new Date().getTime(), metric: "date" })).toBe(
			currentTime,
		);
	});

	it("should return the milliseconds offset when converting to offset-time and metric is not a ticks", () => {
		expect(getMillisecondsByOffsetTime({ value: 10.5, metric: "s" }, {})).toBe(10500);
		expect(getMillisecondsByOffsetTime({ value: 10, metric: "s" }, {})).toBe(10000);
	});

	it("should return the milliseconds offset when converting to offset-time and metric is ticks", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 10_010_000.1, metric: "t" },
				{ "ttp:tickRate": 10_000_000 },
			),
		).toBe(1002);
		expect(
			getMillisecondsByOffsetTime(
				{ value: 10_010_000, metric: "t" },
				{ "ttp:tickRate": 10_000_000 },
			),
		).toBe(1001);
	});
});
