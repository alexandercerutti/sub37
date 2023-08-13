import type { TimeDetails } from ".";
import type { ClockTimeMatch } from "../TimeExpressions/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/offsetTime";
import { getNumberOfDigits } from "../TimeExpressions/math.js";

export function getMillisecondsByClockTime(match: ClockTimeMatch): number {
	const [hours, minutes, seconds, fraction] = match;
	let finalTime = 0;

	const matchedWithContraints = [
		hours,
		Math.max(0, Math.min(minutes, 59)),
		Math.max(0, Math.min(seconds, 59)),
	];

	for (let i = 0; i < 3; i++) {
		const element = matchedWithContraints[i];
		// index: x, arr.length: y => 60^(y-1-x) => ...
		// index: 0, arr.length: 3 => 60^(3-1-0) => 60^2 => number * 3600
		// index: 1, arr.length: 3 => 60^(3-1-1) => 60^1 => number * 60
		// index: 2, arr.length: 3 => 60^(3-1-2) => 60^0 => number * 1
		finalTime += element * 60 ** (3 - 1 - i);
	}

	if (!Number.isNaN(fraction)) {
		const fractionInSeconds = fraction / 10 ** getNumberOfDigits(fraction);
		finalTime += fractionInSeconds;
	}

	return finalTime * 1000;
}

export function getMillisecondsByWallClockTime(): number {
	return 0;
}

/**
 * TTML standard states:
 *
 * ```text
 * If a <time-expression> form does not use the ticks (t) metric, then:
 * C = 3600 * hours + 60 * minutes + seconds
 *
 * where hours, minutes, and seconds components are extracted from time expression
 * if present, or zero if not present;
 * furthermore, a fraction component, if present, is added to the seconds component
 * to form a real-valued seconds component.
 *
 * Otherwise, if a <time-expression> form uses the ticks (t) metric, then:
 *
 * C = ticks / tickRate
 * ```
 *
 * But there is not any other time-expression that allows metrics, so
 * we assume we are talking about offset-time. However, in that case,
 * we don't have hours and minutes.
 *
 * Also TTML standard states:
 *
 * ```text
 * A begin attribute must be specified, the value of which must take the offset-time
 * form of a <time-expression>, and, further, is restricted to use a metric of
 * s (seconds), f (frames), t (ticks), or may omit the metric, in which case s seconds
 * is implied.
 * ```
 *
 * So, even if there are other metrics, we probably should implement just the ones
 * stated above. However, `ticks` is implemented in a different flow, while `frames`
 * should not be considered when using clock time base. Hence, we are considering
 * the data as seconds.
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

	if (metric === "t") {
		return (finalTime / (timeDetails["ttp:tickRate"] || 1)) * 1000;
	}

	if (!Number.isNaN(fraction)) {
		finalTime += fraction / 10 ** getNumberOfDigits(fraction);
	}

	/**
	 * ```text
	 * The frames and sub-frames terms and the frames (f) metric
	 * of time expressions do not apply when using the clock time base.
	 * ```
	 *
	 * Here is assumed we are working in seconds as per the function explanation
	 */

	return finalTime * 1000;
}
