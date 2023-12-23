/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-media-timing
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRate
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRateMultiplier
 */

import type { TimeDetails } from ".";
import type { ClockTimeMatch } from "../TimeExpressions/matchers/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/matchers/offsetTime";
import { getActualFramesInSeconds } from "../TimeExpressions/frames.js";
import { getHHMMSSUnitsToSeconds } from "../TimeExpressions/math.js";

/** To keep track and debug */
export const timeBaseNameSymbol = Symbol("Media");

export function getMillisecondsByClockTime(
	match: ClockTimeMatch,
	timeDetails: TimeDetails,
): number {
	const [hours, minutes, seconds, frames, subframes] = match;

	const finalTime = getHHMMSSUnitsToSeconds(
		hours,
		minutes,
		/**
		 * Removing the decimal part, as a track with
		 * `ttp:timeBase=media` should not have fractional parts
		 */
		Math.trunc(seconds),
	);

	/**
	 * @TODO how to provide previous cue end time?
	 */

	const referenceBegin = 0;

	const framesInSeconds = getActualFramesInSeconds(frames, subframes, timeDetails);

	return (referenceBegin + finalTime + framesInSeconds) * 1000;
}

export function getMillisecondsByWallClockTime(): number {
	throw new Error("WallClockTime is not supported when using Media as 'ttp:timeBase'.");
}

/**
 * TTML states:
 *
 * ```text
 * If a time expression uses a clock-time form or an offset-time form that doesn't use the ticks (t) metric, then:
 *
 * M = referenceBegin + 3600 * hours + 60 * minutes + seconds + ((frames + (subFrames / subFrameRate)) / effectiveFrameRate)
 *
 * ...
 *
 * Otherwise, if a time expression uses an offset-time form that uses the ticks (t) metric, then:
 *
 * M = referenceBegin + ticks / tickRate
 * ```
 *
 * But if we don't use offset-time, no other time-expression uses metrics. In that case, we don't have
 * access to hours and minutes. Therefore we are using only seconds.
 *
 * @param match
 * @param timeDetails
 * @returns
 */

export function getMillisecondsByOffsetTime(
	match: OffsetTimeMatch,
	timeDetails: TimeDetails,
): number {
	const [unit, fraction, metric] = match;
	let finalTime = unit;

	/**
	 * @TODO how to provide previous cue end time?
	 */

	const referenceBegin = 0;

	if (metric === "t") {
		return (finalTime / (timeDetails["ttp:tickRate"] || 1)) * 1000;
	}

	return referenceBegin + (finalTime + fraction) * 1000;
}
