/**
 * SMPTE: Society of Motion Picture and Television Engineers
 * @see https://en.wikipedia.org/wiki/Society_of_Motion_Picture_and_Television_Engineers
 * @see https://en.wikipedia.org/wiki/SMPTE_timecode
 */

import type { TimeDetails } from ".";
import type { ClockTimeMatch } from "../TimeExpressions/matchers/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/matchers/offsetTime";
import { getEffectiveFrameRate, getFrameComputedValue } from "../TimeExpressions/frames.js";
import { getHHMMSSUnitsToSeconds } from "../TimeExpressions/math.js";

export function getMillisecondsByClockTime(
	match: ClockTimeMatch,
	timeDetails: TimeDetails,
): number {
	const [hours, minutes, seconds, , frames, subframes] = match;
	let finalTime = getHHMMSSUnitsToSeconds(hours, minutes, seconds);

	/**
	 * @TODO how to provide previous cue end time?
	 */

	const referenceBegin = 0;

	/**
	 * Subframes are accounted later
	 */
	const framesInSeconds =
		getFrameComputedValue(frames, timeDetails["ttp:frameRate"]) /
		getEffectiveFrameRate(timeDetails);
	const countedFrames = finalTime * timeDetails["ttp:frameRate"] + framesInSeconds;

	const droppedFrames = getDropFrames(
		timeDetails["ttp:dropMode"],
		hours,
		Math.max(0, Math.min(minutes, 59)),
	);

	const totalSubframes =
		getFrameComputedValue(subframes, timeDetails["ttp:subFrameRate"]) /
		timeDetails["ttp:subFrameRate"];

	const totalFrames = countedFrames - droppedFrames + totalSubframes;

	const SMTPETimeBase = totalFrames / getEffectiveFrameRate(timeDetails);
	return referenceBegin + SMTPETimeBase;
}

export function getMillisecondsByWallClockTime(): number {
	throw new Error("WallClockTime is not supported when using SMPTE as 'ttp:timeBase'.");
}

export function getMillisecondsByOffsetTime(match: OffsetTimeMatch): number {
	throw new Error(
		"OffsetTime is not supported when using SMPTE as 'ttp:timeBase' as deprecated in TTML standard.",
	);
}

/**
 * Black-and-white broadcasts were originally streamed at 30fps (NTSC).
 * With the introduction of the color in 1953, fps was reduced to 29.97fps.
 *
 * This translates to have a lag of 0.03 frames between real world and video
 * timecodes: 01:00:00:00 (h:m:s:frames) of real time becomes 00:59:56;12 of video
 * (3.6 seconds). How do we flat the difference? We have to discard some frames
 * from the counting (not from the video, of course).
 *
 * First of all, 30fps is 0.1% faster than 29.97fps (30fps / 29.97fps ≈ 1,001).
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
 *
 * ___
 *
 * The same should be valid for PAL. Normal PAL runs at 25fps so SMPTE
 * doesn't expect any frame reduction. On the other side, M/PAL (Brazil only)
 * is PAL that runs at 29.97fps instead of 30 fps. So we probably want to convert
 * it to NTSC o something like that. I wasn't able to find any precise explanation,
 * so everything might be dependand on the frequencies and something like that.
 *
 * Anyway, we still want to drop 108 frames per hour (h * 180).
 * Then, PAL/M is said to drop 4 frames (00, 01, 02, and 03) if the second of a
 * time expression is 00 and the minute of the time expression **is even** but
 * not 00, 20 or 40.
 *
 * If the second must be 00, we have up to 59 minutes slots on which we could
 * remove 4 frames. 59 * 4 = 236f/m. Too much. But, if we use only even ones:
 * floor(59 / 2) = 29
 * 29 * 4 = 116 f/m. Which is still bigger than 108, but only of 8 frames.
 * So we must remove 8 of them from the dropped ones.
 *
 * So, if we get 4 frames from the two slots ((00*4) + (20*4) + (40*4)), we
 * recover 8 frames. And we get exactly 108 frames.
 *
 * Something I am still missing is why it was chosen to remove 4 frames.
 * For NTSC, it is a matter of having 18f/10min => 2*9/10min.
 *
 * Maybe, if we make the reversed reasoning: 1,8f/m * 10min * 2 = 36f/20min = 4 * 9 / 20 min
 * which is 4 frames times 9 minutes ((20 min / 2) - 1 to have only even seconds).
 *
 * But still, why distributing 1,8f over 20 minutes? Is there a particular reason?
 *
 * Anyway, we get:
 *  - hour * 108/4 = hour * 27 * 4
 *  - floor(minutes / 2), for even numbers, multiplied by 4
 *  - floor(minutes / 20), to get back the 2 slots of frames lost (00 * 4, 20 * 4 and 40 * 4)
 *
 * floor (00 / 20) = 0
 * floor (20 / 20) = 1
 * floor (25 / 20) = 1
 * floor (40 / 20) = 2
 * floor (59 / 20) = 2
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
