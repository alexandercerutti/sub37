/**
 * SMPTE: Society of Motion Picture and Television Engineers
 * @see https://en.wikipedia.org/wiki/Society_of_Motion_Picture_and_Television_Engineers
 * @see https://en.wikipedia.org/wiki/SMPTE_timecode
 */

import type { TimeDetails } from ".";
import type { ClockTimeUnit } from "../TimeExpressions/matchers/clockTime.js";
import type { OffsetTimeUnit } from "../TimeExpressions/matchers/offsetTime.js";
import type { WallClockUnit } from "../TimeExpressions/matchers/wallclockTime.js";
import { getEffectiveFrameRate, clampPositiveFrameRateValue } from "../TimeExpressions/frames.js";
import { getHHMMSSUnitsToSeconds } from "../TimeExpressions/math.js";

/** To keep track and debug */
export const timeBaseNameSymbol = Symbol("SMPTE Time Base");

/**
 *
 * @param match
 * @param timeDetails
 * @param [referenceBegin=0] previous cue end time in milliseconds
 * @returns
 */

export function getMillisecondsByClockTime(
	match: ClockTimeUnit,
	timeDetails: TimeDetails,
	referenceBegin: number = 0,
): number {
	const [
		{ value: hours },
		{ value: minutes },
		{ value: seconds },
		{ value: frames },
		{ value: subframes },
	] = match;
	const hhmmssInSeconds = getHHMMSSUnitsToSeconds(hours, minutes, seconds);

	/**
	 * Subframes are accounted later
	 */
	const clampedFrames = clampPositiveFrameRateValue(frames, timeDetails["ttp:frameRate"]);

	/**
	 * `S = (countedFrames - droppedFrames + subFrames / subFrameRate) / effectiveFrameRate`
	 *
	 * where
	 *
	 * `countedFrames = (3600 * hours + 60 * minutes + seconds) * frameRate + frames`
	 */

	const countedFrames = hhmmssInSeconds * timeDetails["ttp:frameRate"] + clampedFrames;

	const droppedFrames = getDropFrames(
		timeDetails["ttp:dropMode"],
		hours,
		Math.max(0, Math.min(minutes, 59)),
	);

	const subFrameRate =
		clampPositiveFrameRateValue(subframes, timeDetails["ttp:subFrameRate"]) /
		timeDetails["ttp:subFrameRate"];

	const totalFrames = countedFrames - droppedFrames + subFrameRate;

	const timeBaseSeconds = totalFrames / getEffectiveFrameRate(timeDetails);
	return referenceBegin + timeBaseSeconds * 1000;
}

/**
 * "It is considered an error if the wallclock-time form of
 * a <time-expression> is used in a document instance and
 * the government time base is not clock."
 *
 * @see https://w3c.github.io/ttml2/#timing-value-time-expression
 */

export function getMillisecondsByWallClockTime(_date: WallClockUnit): number {
	throw new Error("WallClockTime is not supported when using SMPTE as 'ttp:timeBase'.");
}

/**
 * "If the computed value of the governing time base is smpte,
 * then (1) use of an offset-time form of <time-expression> is
 * deprecated [...]"
 *
 * @see https://w3c.github.io/ttml2/#timing-value-time-expression
 */

export function getMillisecondsByOffsetTime(_match: OffsetTimeUnit): number {
	throw new Error(
		"OffsetTime is not supported when using SMPTE as 'ttp:timeBase' as deprecated in TTML standard.",
	);
}

/**
 * Black-and-white broadcasts were originally streamed at 30fps (NTSC) ("SMPTE 30").
 *
 * This means that video timing, world clock time and frames were synchronized (see
 * table).
 *
 * | frames   | seconds | timecode    |
 * |----------|---------|-------------|
 * | 1800			| 60.0		| 00:01:00:00	|
 * | 107,892	| 3596.4	| 00:59:56:12	|
 * | 108,000	| 3600.0	| 01:00:00:00	|
 *
 * With the introduction of the color in 1953, fps was reduced to 29.97fps by NBC
 * (now NTSC) to accomodate the color information.
 *
 * This translates to have a lag of 0.03 frames between real world and video
 * timecodes. Over short periods of time, this is not an issue but, in an period
 * of one hour of real time (01:00:00:00 (h:m:s:frames)), becomes 00:59:56;12 of
 * video (SMPTE 30), which is a loss of (3.6 seconds).
 *
 * **Running 12 hours consecutively would cause the time code clocks to be 43 seconds
 * off compared to real clocks.**
 *
 * While talking about captioning, captions can get easily desynchronized the
 * longer they become active. That's why it is important to know if the video
 * content was recorded  with a DF (drop frame) or NDF (non-drop frame).
 *
 * This means that we can have an SMPTE 30 content that runs on DF 29.97 fps (DFPS)
 * and a SMPTE 30 content that runs on NDF 29.97 fps.
 *
 * When using a DF Timecode, the way to flat the different is discarding some frames
 * from the counting (we can't, ofc, discard them from the video).
 *
 * 30fps is 0.1% faster than 29.97fps. Ratio is of `30fps / 29.97fps ≈ 1,001`
 * which means that every 1000 frames of real time, we have 1001 frames of timecode time.
 *
 * 1h = 60s * 60m = 3.600s.
 * At 30,00 fps, one hour of content contains 108.000 frames per hour (30,00fps * 3600s)
 * At 29,97 fps, one hour of content contains 107.892 frames per hour (29,97fps * 3600s).
 *
 * There is, therefore, a discrepancy between 30 and 29.97 of:
 *
 * 108.000 - 107.892 = 108 frames
 * 108 frames / 30fps = 3,6s (here we find it again!)
 *
 * 108.000 / 108 = 1.000 (discrepancy of 1/1000)
 *
 * ---
 *
 * 30fps is 0.1% faster than 29.97fps (30 / 29,97 ≈ 1.001)
 *
 * 1m = 60s.
 * At 30,00 fps, one minute of content contains 1800,0 frames per minute (30,00fps * 60s).
 * At 29,97 fps, one minute of content contains 1798,2 frames per minute (29,97fps * 60s).
 *
 * There is, therefore, a discrepancy between 30 and 29.97 of:
 *
 * 1800 - 1798,2 = 1.8 frames / minute
 * 1.8 * 1000 = 1800 (here we find it again)
 *
 * ---
 *
 * We might add 1.8 frame each minute, but frames are not fractionable!
 * We can, instead, add 18 frames every 10 minutes. So, listen up:
 * 10 / 18 is not evenly distributable (integer). 10 minutes is made of
 * 10 * 1 minute. What is the nearest number? 9, which is 18 * 2.
 *
 * So we can think to remove 2 frames every minute for 9 minutes and
 * not apply this rule for the 10th.
 *
 * By doing this, we skip 6 minutes: 00, 10, 20, 30, 40, and 50 (up to total 59).
 *
 * Therefore we discard 2 frames per minutes per 54 minute. Therefore, each hour
 * we discard 108 frames!! (60 - 6 minutes * 2 = 54 * 2 = 108). YAY!
 *
 * Then we have to add the right amount of frames for the minutes we have in
 * our real timecode.
 *
 * We want to remove 2 frames each minute more (2 * 59 = 118 frames)
 * However we get too much frames: we must have up to 108.
 * There's a difference of 10 frames.
 *
 * So we can divide the minute by 10 and floor everything to avoid the decimal part.
 * Minutes can be up to 59.
 *
 * floor (00 / 10) = 0
 * floor (01 / 10) = 0
 * floor (10 / 10) = 1
 * floor (20 / 10) = 2
 * floor (30 / 10) = 3
 * floor (40 / 10) = 4
 * floor (50 / 10) = 5
 * floor (59 / 10) = 5
 *
 * So we can reach up to 5 minutes times 2 frames to be removed and add
 * back these frames (2 per each minute skipped, as above).
 *
 * For NTSC we end up with the following formula and recap:
 *
 * - 108 frames per hour removed = 54 * 2 frames per hour removed;
 * - 2 frames per minute removed = 1 * 2 frames per minute removed;
 * - 2 frames recovered per up to 5 minutes.
 *
 * Becomes:
 *
 *   (hours * 54 * 2) + (minutes * 2) - (floor(minute / 10) * 2) =
 * = (hours * 54 + minutes - floor (minute / 10)) * 2.
 *
 * @see https://studylib.net/doc/18881551/an-explanantion-of-drop-frame-vs.-non-drop
 * @see https://support.telestream.net/s/article/Time-code-for-23-976-frames-per-second-video
 *
 * ___
 *
 * The same is valid for PAL. Normally, PAL runs at 25fps. SMPTE doesn't expect
 * any frame reduction for it. However, M/PAL (Brazil only) runs at 29.97fps
 * instead of 30fps.
 *
 * So, we need to drop frames in a similar way as NTSC.
 *
 * M/PAL is equally 0.1% slower than 30fps. Ratio is of `30fps / 29.97fps ≈ 1,001`
 * which means that every 1000 frames of real time, we have 1001 frames of timecode time.
 *
 * We have, over one hour, 60 slots (minutes 00-59): 30 even and 30 odd.
 * If we exclude the 00, 20, 40 minutes from the even ones, we reach 27 even minutes
 * we can operate on.
 *
 * The chosen pattern by engineers was to drop 4 frames (00-03) at every even minute
 * except 00, 20, 40.
 *
 * `4 × 27 = 108 frames / hour`, which is exactly the drift we need to compensate
 * (same as NTSC above).
 *
 * If we count how many "drop events" per even minute we have, we therefore have:
 *
 * 	floor (00 / 2) = 0   ← minute 0 is never counted (outputs 0), so it's implicitly excluded
 * 	floor (02 / 2) = 1
 *  ...
 * 	floor (18 / 2) = 9
 * 	floor (20 / 2) = 10  ← wrongly counted; minute 20 should be excluded
 *  ...
 * 	floor (40 / 2) = 20  ← wrongly counted; minute 40 should be excluded
 *  ...
 * 	floor (58 / 2) = 29
 *
 * Which means that 2 drop events should be... dropped (badum, tss), which means subtracted.
 *
 * In order to drop these two events, if we divide `floor(m / 20)` we get:
 *
 * 	floor (00 / 20) = 0
 *  ...
 * 	floor (19 / 20) = 0
 * 	floor (20 / 20) = 1
 *  ...
 * 	floor (39 / 20) = 1
 * 	floor (40 / 20) = 2
 *  ...
 * 	floor (59 / 20) = 2
 *
 * So `floor(m/2) - floor(m/20)` gives the number of drop-events up to minute m.
 *
 * ---
 *
 * Okay, yeah, this seems the perfect example for the analogy of "the importance of
 * a horse ass" (seriously, go looking for it. This story about legacy systems that
 * influence actual systems is amazing!)
 *
 * @param dropMode
 * @param time
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#time-expression-semantics-smpte
 * @returns
 */

function getDropFrames(
	dropMode: TimeDetails["ttp:dropMode"],
	hours: number,
	minutes: number,
): number {
	if (!dropMode) {
		return 0;
	}

	if (dropMode === "dropNTSC") {
		return (hours * 54 + minutes - Math.floor(minutes / 10)) * 2;
	}

	/**
	 * Phase Alternate Line
	 * Valid only for M/PAL or PAL-M, which is used
	 * only in Brasil
	 */
	if (dropMode === "dropPAL") {
		return (hours * 27 + Math.floor(minutes / 2) - Math.floor(minutes / 20)) * 4;
	}

	// nonDrop mode
	return 0;
}
