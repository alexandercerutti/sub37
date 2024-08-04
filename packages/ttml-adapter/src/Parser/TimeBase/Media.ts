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
export const timeBaseNameSymbol = Symbol("Media Time Base");

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
 * "If a time expression uses a clock-time form or an offset-time
 * form that doesn't use the ticks (t) metric, then:
 *
 * 		M = referenceBegin + 3600 * hours + 60 * minutes + seconds + ((frames + (subFrames / subFrameRate)) / effectiveFrameRate)
 *
 * [...]
 *
 * Otherwise, if a time expression uses an offset-time form that
 * uses the ticks (t) metric, then:
 *
 * 		M = referenceBegin + ticks / tickRate
 * "
 *
 * However, omitting the "t" metric leaves us to the subset
 * ("h" | "m" | "s" | "ms" | "f"). Since only one of them
 * can be used in the same expression, using the first expression
 * is not exactly possible as, if we take "10s" as an example,
 * we would have:
 *
 * ```
 * 		M = referenceBegin + 3600 * 0 + 60 * 0 + 10 + ((0 + (0 / subFrameRate)) / effectiveFrameRate)
 * ```
 *
 * - This is surely valid for the subset ("h" | "m" | "s").
 * - Using "ms" as a metric is a straight-forward operation as we
 * 		aim to get milliseconds;
 * - Using "f" as a metric requires us to look at the final part
 * 		of the formula above.
 *
 * Same TTML zone also specifies such:
 *
 * "furthermore, [...] if the time expression takes the form of
 * an offset-time expression, then the fraction component, if
 * present, is added to the time-count component to form a
 * real-valued time count component according to the specified
 * offset metric"
 *
 * However, what's not very clear (yet) is which metric, outside
 * "h" | "m" | "s" | "f", allow having a fraction... maybe the current
 * implementation is not very correct and will require an adjustment.
 * How should it be considered in case of milliseconds?
 * Is correct to use fraction as a fraction of seconds in case of "h" and
 * "m"?
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
	const [timeCount, fraction = 0, metric] = match;

	if (metric === "t") {
		// e.g. 10_100_000 / 10_000_000 = 1,001 * 1000 = 1000.99999999. Don't need that decimal part.
		return Math.ceil((timeCount / (timeDetails["ttp:tickRate"] || 1)) * 1000);
	}

	if (metric === "f") {
		const framesInSeconds = getActualFramesInSeconds(timeCount, fraction, timeDetails);
		return referenceBegin + (timeCount + framesInSeconds) * 1000;
	}

	if (metric === "ms") {
		// How is fraction used here? Should it be considered as a millisecond?
		return referenceBegin + timeCount;
	}

	if (metric === "s") {
		return referenceBegin + (timeCount + fraction) * 1000;
	}

	if (metric === "m") {
		const fractionAsSeconds = fraction * 60;
		return referenceBegin + (timeCount * 60 + fractionAsSeconds) * 1000;
	}

	const fractionAsMinutes = fraction * 60;
	return referenceBegin + (timeCount * 3600 + fractionAsMinutes * 60) * 1000;
}
