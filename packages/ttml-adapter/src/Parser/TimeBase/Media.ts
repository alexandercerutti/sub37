/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-media-timing
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRate
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRateMultiplier
 */

import type { TimeDetails } from ".";
import type { ClockTimeMatch } from "../TimeExpressions/matchers/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/matchers/offsetTime";
import type { WallClockMatch } from "../TimeExpressions/matchers/wallclockTime";
import { getActualFramesInSeconds } from "../TimeExpressions/frames.js";
import { getHHMMSSUnitsToSeconds } from "../TimeExpressions/math.js";

/** To keep track and debug */
export const timeBaseNameSymbol = Symbol("Media");

/**
 * @param match
 * @param timeDetails
 * @param [referenceBegin=0] previous cue end time in milliseconds
 * @returns
 */

export function getMillisecondsByClockTime(
	match: ClockTimeMatch,
	timeDetails: TimeDetails,
	referenceBegin: number = 0,
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

	const framesInSeconds = getActualFramesInSeconds(frames, subframes, timeDetails);

	return referenceBegin + (finalTime + framesInSeconds) * 1000;
}

/**
 * "It is considered an error if the wallclock-time form of
 * a <time-expression> is used in a document instance and
 * the government time base is not clock."
 *
 * @see https://w3c.github.io/ttml2/#timing-value-time-expression
 */

export function getMillisecondsByWallClockTime(_date: WallClockMatch): number {
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
 * @param [referenceBegin=0] previous cue end time in milliseconds
 * @returns
 */

export function getMillisecondsByOffsetTime(
	match: OffsetTimeMatch,
	timeDetails: TimeDetails,
	referenceBegin: number = 0,
): number {
	const [ticks, fraction, metric] = match;

	if (metric === "t") {
		return (ticks / (timeDetails["ttp:tickRate"] || 1)) * 1000;
	}

	return referenceBegin + (ticks + fraction) * 1000;
}
