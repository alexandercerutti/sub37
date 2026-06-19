import { describe, expect, it } from "@jest/globals";
import { getMillisecondsByWallClockTime } from "../../lib/Parser/TimeBase/SMPTE.js";
import { getMillisecondsByOffsetTime } from "../../lib/Parser/TimeBase/SMPTE.js";
import { getMillisecondsByClockTime } from "../../lib/Parser/TimeBase/SMPTE.js";

describe("When timeBase is 'smpte'", () => {
	describe("non-drop dropMode", () => {
		it("should return the milliseconds with frames, subframes, hours, minutes and seconds, when converting clock-time", () => {
			/**
			 * No frames dropped, one hour at 29.97fps = 107,892 frames
			 */
			expect(
				getMillisecondsByClockTime(
					[
						{ value: 1, metric: "hours" },
						{ value: 0, metric: "minutes" },
						{ value: 0, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "nonDrop",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				),
			).toBe(3600000);
		});
	});

	describe("drop-NTSC dropMode", () => {
		it("should return the milliseconds with frames, subframes, hours, minutes and seconds, when converting clock-time", () => {
			/**
			 * NDF Timecode at 00:59:56.12 should be
			 * equal to one clock time hour, which
			 * is equal to 01:00:00.00 with NTSC DF.
			 */

			{
				const nonDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 0, metric: "hours" },
						{ value: 59, metric: "minutes" },
						{ value: 56, metric: "seconds" },
						{ value: 12, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "nonDrop",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				const ntscDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 1, metric: "hours" },
						{ value: 0, metric: "minutes" },
						{ value: 0, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "dropNTSC",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(3596);
				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(
					Math.trunc(ntscDropFrameTimeCode / 1000),
				);
			}

			{
				const nonDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 11, metric: "hours" },
						{ value: 59, metric: "minutes" },
						{ value: 16, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "nonDrop",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				const ntscDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 12, metric: "hours" },
						{ value: 0, metric: "minutes" },
						{ value: 0, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "dropNTSC",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(43156);
				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(
					Math.trunc(ntscDropFrameTimeCode / 1000),
				);

				const ntscDropFrameTimeCodeSeconds = ntscDropFrameTimeCode / 1000;
				const twelveHoursInSeconds = 3600 * 12;

				expect(Math.trunc(twelveHoursInSeconds - ntscDropFrameTimeCodeSeconds)).toBe(43);
			}
		});
	});

	describe("drop-PAL dropMode", () => {
		it("should return the milliseconds with frames, subframes, hours, minutes and seconds, when converting clock-time", () => {
			/**
			 * M/PAL drops the same 108 frames/hour as NTSC, so the same
			 * equivalence properties hold. These assertions are derived from
			 * the known 108 frames/hour drift (see NTSC description above),
			 * not from a real M/PAL reference implementation.
			 */

			{
				const nonDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 0, metric: "hours" },
						{ value: 59, metric: "minutes" },
						{ value: 56, metric: "seconds" },
						{ value: 12, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "nonDrop",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				const palDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 1, metric: "hours" },
						{ value: 0, metric: "minutes" },
						{ value: 0, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "dropPAL",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(3596);
				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(
					Math.trunc(palDropFrameTimeCode / 1000),
				);
			}

			{
				const nonDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 11, metric: "hours" },
						{ value: 59, metric: "minutes" },
						{ value: 16, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "nonDrop",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				const palDropFrameTimeCode = getMillisecondsByClockTime(
					[
						{ value: 12, metric: "hours" },
						{ value: 0, metric: "minutes" },
						{ value: 0, metric: "seconds" },
						{ value: 0, metric: "frames" },
						{ value: 0, metric: "subframes" },
					],
					{
						"ttp:dropMode": "dropPAL",
						"ttp:frameRate": 29.97,
						"ttp:subFrameRate": 1,
						"ttp:frameRateMultiplier": 1,
					},
				);

				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(43156);
				expect(Math.trunc(nonDropFrameTimeCode / 1000)).toBe(
					Math.trunc(palDropFrameTimeCode / 1000),
				);

				const palDropFrameTimeCodeSeconds = palDropFrameTimeCode / 1000;
				const twelveHoursInSeconds = 3600 * 12;

				expect(Math.trunc(twelveHoursInSeconds - palDropFrameTimeCodeSeconds)).toBe(43);
			}
		});
	});

	it("should throw when converting wallclock-time", () => {
		expect(() =>
			getMillisecondsByWallClockTime({ value: new Date().getTime(), metric: "date" }),
		).toThrow();
	});

	it("should throw when converting offset-time", () => {
		expect(() =>
			getMillisecondsByOffsetTime({ value: new Date().getTime(), metric: "f" }),
		).toThrow();
	});
});
