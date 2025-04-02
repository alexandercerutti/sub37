import { describe, expect, it } from "@jest/globals";
import {
	getMillisecondsByClockTime,
	getMillisecondsByOffsetTime,
	getMillisecondsByWallClockTime,
} from "../../lib/Parser/TimeBase/Media.js";

describe("When timeBase is 'media'", () => {
	it("should return the milliseconds with frames when converting clock-time", () => {
		expect(
			getMillisecondsByClockTime(
				[
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
						value: 0.2,
						metric: "subframes",
					},
				],
				{
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
					"ttp:frameRateMultiplier": 1000 / 1001,
				},
			),
		).toBe(4_531_509.3416666667);
	});

	it("should use a referenceBegin parameter when converting clock-time", () => {
		expect(
			getMillisecondsByClockTime(
				[
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
						value: 0.2,
						metric: "subframes",
					},
				],
				{
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
					"ttp:frameRateMultiplier": 1000 / 1001,
				},
				50000,
			),
		).toBe(4_581_509.3416666667);
	});

	it("should throw when converting wallclock-time", () => {
		expect(() =>
			getMillisecondsByWallClockTime({ value: new Date().getTime(), metric: "date" }),
		).toThrow();
	});

	it("should return the milliseconds when converting an offset-time with ticks metric", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 24, metric: "t" },
				{
					"ttp:tickRate": 60,
				},
			),
		).toBe(400);
	});

	it("should return the milliseconds when converting an offset-time with frame metric", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 24.5, metric: "f" },
				{
					"ttp:tickRate": 60,
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
				},
			),
		).toBe(1021);
	});

	it("should return the milliseconds when converting an offset-time with milliseconds metric", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 15.3, metric: "ms" },
				{
					"ttp:tickRate": 60,
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
				},
			),
		).toBe(15.3);
	});

	it("should return the milliseconds when converting an offset-time with seconds metric", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 15.3, metric: "s" },
				{
					"ttp:tickRate": 60,
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
				},
			),
		).toBe(15300);
	});

	it("should return the milliseconds when converting an offset-time with minutes metric", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 15.3, metric: "m" },
				{
					"ttp:tickRate": 60,
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
				},
			),
		).toBe(918000);
	});

	it("should return the milliseconds when converting an offset-time with hours metric", () => {
		expect(
			getMillisecondsByOffsetTime(
				{ value: 15.3, metric: "h" },
				{
					"ttp:tickRate": 60,
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
				},
			),
		).toBe(55080000);
	});

	it("should return the milliseconds when converting an offset-time with unknown metric, by treating it as hours", () => {
		expect(
			getMillisecondsByOffsetTime(
				{
					value: 15.3,
					// @ts-expect-error
					metric: "k",
				},
				{
					"ttp:tickRate": 60,
					"ttp:frameRate": 24,
					"ttp:subFrameRate": 1, // fallback
				},
			),
		).toBe(55080000);
	});
});
